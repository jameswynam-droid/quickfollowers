import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLES_TO_SYNC = ['profiles', 'services', 'orders', 'transactions', 'payments', 'tickets'] as const;
const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')?.trim();
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const internalUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const internalKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    if (!externalUrl || !externalKey || !internalUrl || !internalKey) {
      throw new Error('Missing required environment variables');
    }

    const internal = createClient(internalUrl, internalKey);
    const external = createClient(externalUrl, externalKey);

    // Parse request body for selective sync
    let body: { tables?: string[]; event?: string; table?: string; record?: any; old_record?: any } = {};
    try {
      body = await req.json();
    } catch {
      // No body = full sync
    }

    // If this is a webhook call (real-time single record sync)
    if (body.event && body.table && body.record) {
      return await handleWebhookSync(external, body);
    }

    // Otherwise, do a full sync
    const tablesToSync = body.tables?.length 
      ? TABLES_TO_SYNC.filter(t => body.tables!.includes(t))
      : [...TABLES_TO_SYNC];

    const results: Record<string, { synced: number; errors: string[] }> = {};

    // Sync services first (orders depends on it), then profiles (orders/transactions depend on it)
    const orderedTables = reorderTables(tablesToSync);

    for (const table of orderedTables) {
      console.log(`Syncing table: ${table}`);
      results[table] = { synced: 0, errors: [] };

      try {
        // Fetch all records from internal DB (handle pagination)
        let allRecords: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await internal
            .from(table)
            .select('*')
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

        // Upsert in batches
        for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
          const batch = allRecords.slice(i, i + BATCH_SIZE);
          const { error: upsertError } = await external
            .from(table)
            .upsert(batch, { onConflict: 'id' });

          if (upsertError) {
            console.error(`  Batch error for ${table}:`, upsertError.message);
            results[table].errors.push(upsertError.message);
          } else {
            results[table].synced += batch.length;
          }
        }

        // Delete records from external that no longer exist in internal
        if (allRecords.length > 0) {
          const internalIds = allRecords.map(r => r.id);
          
          // Fetch external IDs
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

          const idsToDelete = externalIds.filter(id => !internalIds.includes(id));
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

  // Only sync tables we care about
  if (!TABLES_TO_SYNC.includes(table as any)) {
    return new Response(JSON.stringify({ skipped: true, reason: `Table ${table} not in sync list` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Webhook sync: ${event} on ${table}, id: ${record?.id || old_record?.id}`);

  try {
    if (event === 'INSERT' || event === 'UPDATE') {
      const { error } = await external
        .from(table)
        .upsert(record, { onConflict: 'id' });
      if (error) throw error;
    } else if (event === 'DELETE' && old_record) {
      const { error } = await external
        .from(table)
        .delete()
        .eq('id', old_record.id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, event, table }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`Webhook sync error for ${table}:`, err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

function reorderTables(tables: string[]): string[] {
  // Services and profiles must be synced before orders/transactions/payments
  const priority = ['services', 'profiles'];
  const ordered = priority.filter(t => tables.includes(t));
  const rest = tables.filter(t => !priority.includes(t));
  return [...ordered, ...rest];
}
