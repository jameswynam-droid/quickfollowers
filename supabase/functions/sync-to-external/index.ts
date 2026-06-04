import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TABLES_TO_SYNC = [
  'profiles', 'services', 'user_roles',
  'orders', 'transactions', 'payments',
  'tickets', 'ticket_reads',
  'notifications', 'bell_notifications', 'floating_bell_notifications',
  'pending_email_changes',
] as const;
const BATCH_SIZE = 500;
const EXTERNAL_TIMEOUT_MS = 8000; // 8s timeout for external calls

const TABLE_COLUMNS: Record<string, string> = {
  profiles: 'id, full_name, email, balance, username, created_at, updated_at',
  services: 'id, name, category, type, rate, min_order, max_order, description, provider, average_time, dripfeed, created_at, updated_at',
  user_roles: 'id, user_id, role, created_at',
  orders: 'id, user_id, service_id, link, quantity, charge, status, api_order_id, start_count, remains, failure_reason, runs, interval_minutes, comments, keywords, username, min, max, posts, old_posts, delay, expiry, created_at, updated_at',
  transactions: 'id, user_id, type, amount, balance_after, description, reference_id, payment_method, short_id, created_at',
  payments: 'id, user_id, amount, status, approved_by, approved_at, proof_url, bank_details, notes, created_at, updated_at',
  tickets: 'id, user_id, subject, status, priority, created_at, updated_at',
  ticket_reads: 'id, user_id, ticket_id, last_read_at',
  notifications: 'id, title, message, type, is_active, created_by, expires_at, created_at, updated_at',
  bell_notifications: 'id, title, message, type, is_active, created_by, created_at, updated_at',
  floating_bell_notifications: 'id, title, summary, content, is_active, created_by, created_at, updated_at',
  pending_email_changes: 'id, user_id, old_email, new_email, confirmation_token, old_email_confirmed, new_email_verified, expires_at, completed_at, created_at',
};

// Quick health check - verify external project is reachable before doing work
async function checkExternalHealth(externalUrl: string, externalKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${externalUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': externalKey,
        'Authorization': `Bearer ${externalKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // 200, 401, 403 all mean the project is reachable (401/403 = auth required but online)
    return res.status < 500;
  } catch {
    return false;
  }
}

function pickColumns(table: string, record: any): any {
  const colStr = TABLE_COLUMNS[table];
  if (!colStr) return record;
  const cols = colStr.split(',').map(c => c.trim());
  const filtered: any = {};
  for (const col of cols) {
    if (col in record) {
      filtered[col] = record[col];
    }
  }
  return filtered;
}

function reorderTables(tables: string[]): string[] {
  // Parent tables first, then dependent tables
  const priority = ['services', 'profiles', 'user_roles', 'tickets'];
  const ordered = priority.filter(t => tables.includes(t));
  const rest = tables.filter(t => !priority.includes(t));
  return [...ordered, ...rest];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sanitize = (val: string | undefined) => val?.replace(/[^\x20-\x7E]/g, '').trim();
    
    const externalUrl = sanitize(Deno.env.get('EXTERNAL_SUPABASE_URL'));
    const externalKey = sanitize(Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY'));
    const internalUrl = sanitize(Deno.env.get('SUPABASE_URL'));
    const internalKey = sanitize(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    if (!externalUrl || !externalKey || !internalUrl || !internalKey) {
      throw new Error('Missing required environment variables');
    }

    // Parse body
    let body: { tables?: string[]; event?: string; table?: string; record?: any; old_record?: any } = {};
    try {
      body = await req.json();
    } catch {
      // No body = full sync
    }

    // Health check - fast fail if external project is unavailable
    const isHealthy = await checkExternalHealth(externalUrl, externalKey);
    if (!isHealthy) {
      const msg = 'External project is unreachable (possibly paused). Skipping sync.';
      console.warn(msg);
      return new Response(JSON.stringify({ skipped: true, reason: msg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const external = createClient(externalUrl, externalKey);

    // Webhook call (real-time single record sync)
    if (body.event && body.table && body.record) {
      return await handleWebhookSync(external, {
        event: body.event,
        table: body.table,
        record: body.record,
        old_record: body.old_record,
      });
    }

    // Full sync
    const internal = createClient(internalUrl, internalKey);
    const tablesToSync = body.tables?.length 
      ? TABLES_TO_SYNC.filter(t => body.tables!.includes(t))
      : [...TABLES_TO_SYNC];

    const results: Record<string, { synced: number; errors: string[] }> = {};
    const orderedTables = reorderTables(tablesToSync);

    for (const table of orderedTables) {
      console.log(`Syncing table: ${table}`);
      results[table] = { synced: 0, errors: [] };

      try {
        const columns = TABLE_COLUMNS[table] || '*';
        let allRecords: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await internal
            .from(table)
            .select(columns)
            .range(offset, offset + 999)
            .order('created_at', { ascending: true });

          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allRecords = allRecords.concat(data);
            offset += data.length;
            if (data.length < 1000) hasMore = false;
          }
        }

        console.log(`  Fetched ${allRecords.length} records from ${table}`);

        for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
          const batch = allRecords.slice(i, i + BATCH_SIZE);
          const { error: upsertError } = await external
            .from(table)
            .upsert(batch, { onConflict: 'id' });

          if (upsertError) {
            console.error(`  Batch error for ${table}:`, upsertError.message);
            let batchSuccess = 0;
            const failedIds: string[] = [];
            for (const record of batch) {
              const { error: singleError } = await external
                .from(table)
                .upsert(record, { onConflict: 'id' });
              if (singleError) {
                failedIds.push(record.id);
              } else {
                batchSuccess++;
              }
            }
            results[table].synced += batchSuccess;
            if (failedIds.length > 0) {
              const msg = `${failedIds.length} records failed: ${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '...' : ''}`;
              results[table].errors.push(msg);
            }
          } else {
            results[table].synced += batch.length;
          }
        }

        // Delete orphaned records from external
        if (allRecords.length > 0) {
          const internalIds = new Set(allRecords.map(r => r.id));
          let externalIds: string[] = [];
          let extOffset = 0;
          let extHasMore = true;
          while (extHasMore) {
            const { data: extData } = await external
              .from(table)
              .select('id')
              .range(extOffset, extOffset + 999);
            if (!extData || extData.length === 0) {
              extHasMore = false;
            } else {
              externalIds = externalIds.concat(extData.map(r => r.id));
              extOffset += extData.length;
              if (extData.length < 1000) extHasMore = false;
            }
          }

          const idsToDelete = externalIds.filter(id => !internalIds.has(id));
          if (idsToDelete.length > 0) {
            for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
              const batch = idsToDelete.slice(i, i + BATCH_SIZE);
              await external.from(table).delete().in('id', batch);
            }
            console.log(`  Deleted ${idsToDelete.length} orphaned records from ${table}`);
          }
        }

        console.log(`  Synced ${results[table].synced} records for ${table}`);
      } catch (err) {
        console.error(`  Failed to sync ${table}:`, err);
        results[table].errors.push(String(err));
      }
    }

    console.log('Full sync complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleWebhookSync(
  external: any,
  payload: { event: string; table: string; record: any; old_record?: any }
) {
  const { event, table, record, old_record } = payload;

  if (!TABLES_TO_SYNC.includes(table as any)) {
    return new Response(JSON.stringify({ skipped: true, reason: `Table ${table} not in sync list` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Webhook sync: ${event} on ${table}, id: ${record?.id || old_record?.id}`);

  try {
    if (event === 'INSERT' || event === 'UPDATE') {
      const syncRecord = pickColumns(table, record);
      const { error } = await external
        .from(table)
        .upsert(syncRecord, { onConflict: 'id' });
      if (error) {
        // Detect HTML error pages (e.g. 522 timeout from paused/overloaded projects)
        if (error.message?.includes('<!DOCTYPE') || error.message?.includes('Connection timed out')) {
          console.warn(`External project unavailable for ${table}, skipping webhook sync`);
          return new Response(JSON.stringify({ skipped: true, reason: 'External project unavailable' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    } else if (event === 'DELETE' && old_record) {
      const { error } = await external
        .from(table)
        .delete()
        .eq('id', old_record.id);
      if (error) {
        if (error.message?.includes('<!DOCTYPE') || error.message?.includes('Connection timed out')) {
          console.warn(`External project unavailable for ${table}, skipping webhook delete`);
          return new Response(JSON.stringify({ skipped: true, reason: 'External project unavailable' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true, event, table }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('<!DOCTYPE') || errStr.includes('Connection timed out')) {
      console.warn(`External project unavailable for ${table}, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'External project unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error(`Webhook sync error for ${table}:`, err);
    return new Response(JSON.stringify({ error: errStr }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
