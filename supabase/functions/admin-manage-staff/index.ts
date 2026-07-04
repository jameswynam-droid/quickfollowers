import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ success: false, error: 'Please sign in again.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: 'Staff management is not configured. Please contact the site owner.' }, 500);
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !user) return json({ success: false, error: 'Please sign in again.' });

    // Caller must be full admin
    const { data: myRoles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    if (!(myRoles || []).some((r: any) => r.role === 'admin')) return json({ success: false, error: 'Only admins can manage staff accounts.' });

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
      if (!isEmail(email)) return json({ success: false, error: 'Enter a valid email address.' });
      if (!password || password.length < 12) return json({ success: false, error: 'Password must be at least 12 characters.' });

      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if ((existing?.users || []).some((u: any) => String(u.email || '').toLowerCase() === email)) {
        return json({ success: false, error: 'This email is already in use.' });
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createErr || !created.user) {
        return json({ success: false, error: createErr?.message?.includes('already') ? 'This email is already in use.' : 'Could not create staff account.' });
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
      if (!targetId) return json({ success: false, error: 'Choose a staff account first.' });
      if (targetId === user.id && role === 'admin') return json({ success: false, error: 'You cannot remove your own admin role.' });
      await admin.from('user_roles').delete().eq('user_id', targetId).eq('role', role);
      return json({ success: true });
    }

    if (action === 'delete') {
      const targetId = String(body.user_id || '');
      if (!targetId) return json({ success: false, error: 'Choose a staff account first.' });
      if (targetId === user.id) return json({ success: false, error: 'You cannot delete your own staff account.' });

      const { data: targetRoles } = await admin.from('user_roles').select('role').eq('user_id', targetId).in('role', ['admin', 'support']);
      if (!(targetRoles || []).length) return json({ success: false, error: 'This account is not a staff account.' });

      await admin.from('admin_totp').delete().eq('user_id', targetId);
      await admin.from('user_roles').delete().eq('user_id', targetId).in('role', ['admin', 'support']);
      const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId, false);
      if (deleteErr) return json({ success: false, error: 'Could not delete staff account.' });
      return json({ success: true });
    }

    if (action === 'reset_password') {
      const targetId = String(body.user_id || '');
      const password = String(body.password || '');
      if (!targetId || password.length < 12) return json({ success: false, error: 'Choose a staff account and use a 12+ character password.' });
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return json({ success: false, error: 'Could not reset password.' });
      // Reset their TOTP so they re-enroll
      await admin.from('admin_totp').delete().eq('user_id', targetId);
      return json({ success: true });
    }

    return json({ success: false, error: 'Unknown staff action.' });
  } catch (e: any) {
    return json({ success: false, error: 'Staff management request failed. Please try again.' }, 500);
  }
});
