// TEMPORARY one-shot bootstrap. Delete this function file immediately after use.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'missing' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (found) userId = found.id;
      if (data.users.length < 200) break;
    }

    if (userId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: crErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name || 'Support Admin' },
      });
      if (crErr) throw crErr;
      userId = created.user!.id;
    }

    await admin.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
