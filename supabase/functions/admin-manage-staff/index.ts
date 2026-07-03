import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    // Caller must be full admin
    const { data: myRoles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    if (!(myRoles || []).some((r: any) => r.role === 'admin')) return json({ error: 'Admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'list') {
      const { data: rows } = await admin
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'support']);
      const ids = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
      const staff: any[] = [];
      for (const id of ids) {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user) {
          const roles = (rows || []).filter((r: any) => r.user_id === id).map((r: any) => r.role);
          staff.push({ id, email: u.user.email, roles, created_at: u.user.created_at });
        }
      }
      return json({ success: true, staff });
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'support';
      if (!email || !password || password.length < 12) return json({ error: 'Email and 12+ char password required' }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message || 'Could not create user' }, 400);
      }
      const newId = created.user.id;
      await admin.from('user_roles').upsert({ user_id: newId, role }, { onConflict: 'user_id,role' });
      // Ensure a profile row exists
      await admin.from('profiles').upsert({ id: newId, email, full_name: role === 'admin' ? 'Admin' : 'Support' }, { onConflict: 'id' });
      return json({ success: true, id: newId });
    }

    if (action === 'revoke') {
      const targetId = String(body.user_id || '');
      const role = body.role === 'admin' ? 'admin' : 'support';
      if (!targetId) return json({ error: 'user_id required' }, 400);
      if (targetId === user.id && role === 'admin') return json({ error: 'You cannot revoke your own admin role' }, 400);
      await admin.from('user_roles').delete().eq('user_id', targetId).eq('role', role);
      return json({ success: true });
    }

    if (action === 'reset_password') {
      const targetId = String(body.user_id || '');
      const password = String(body.password || '');
      if (!targetId || password.length < 12) return json({ error: 'user_id and 12+ char password required' }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return json({ error: error.message }, 400);
      // Reset their TOTP so they re-enroll
      await admin.from('admin_totp').delete().eq('user_id', targetId);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e?.message || 'Failed' }, 500);
  }
});
