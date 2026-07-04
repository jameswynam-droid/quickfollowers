import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ success: false, error: 'Please sign in again.' });
    const { code } = await req.json();
    if (!code || !/^\d{6}$/.test(code)) return json({ success: false, error: 'Enter the 6-digit authenticator code.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ success: false, error: '2FA verification is not configured. Please contact the site owner.' }, 500);

    const supabaseAuth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(jwt);
    if (error || !user) return json({ success: false, error: 'Please sign in again.' });

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'support']);
    if (!(roles || []).length) return json({ success: false, error: 'This account is not allowed to use staff 2FA.' });

    const { data: row } = await admin.from('admin_totp').select('secret').eq('user_id', user.id).maybeSingle();
    if (!row?.secret) return json({ success: false, error: 'Start 2FA setup before verifying a code.' });

    const totp = new OTPAuth.TOTP({ issuer: 'QuickFollowers', label: user.email || 'admin', secret: OTPAuth.Secret.fromBase32(row.secret) });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return json({ success: false, error: 'Incorrect code. Please try again.' });

    await admin.from('admin_totp').update({ verified: true, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', user.id);
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: '2FA verification could not be completed. Please try again.' }, 500);
  }
});
