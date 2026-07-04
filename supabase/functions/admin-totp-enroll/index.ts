import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.2';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ success: false, error: '2FA setup is not configured. Please contact the site owner.' }, 500);

    const supabaseAuth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error } = await supabaseAuth.auth.getUser(jwt);
    if (error || !user?.email) return json({ success: false, error: 'Please sign in again.' });

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'support']);
    if (!(roles || []).length) return json({ success: false, error: 'This account is not allowed to set up staff 2FA.' });

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'QuickFollowers',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    const uri = totp.toString();
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 300 });

    // Upsert unverified secret
    await admin.from('admin_totp').upsert({ user_id: user.id, secret: secret.base32, verified: false });

    return json({ success: true, qr_data_url: qr, secret: secret.base32 });
  } catch (e) {
    return json({ success: false, error: '2FA setup could not be started. Please try again.' }, 500);
  }
});
