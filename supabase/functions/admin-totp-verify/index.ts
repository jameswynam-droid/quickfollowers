import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { code } = await req.json();
    if (!code || !/^\d{6}$/.test(code)) return new Response(JSON.stringify({ error: 'Invalid code format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(jwt);
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: row } = await admin.from('admin_totp').select('secret').eq('user_id', user.id).maybeSingle();
    if (!row?.secret) return new Response(JSON.stringify({ error: 'No enrollment in progress' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const totp = new OTPAuth.TOTP({ issuer: 'QuickFollowers', label: user.email || 'admin', secret: OTPAuth.Secret.fromBase32(row.secret) });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return new Response(JSON.stringify({ error: 'Incorrect code — try again' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await admin.from('admin_totp').update({ verified: true, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', user.id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Verify failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
