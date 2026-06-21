import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return false;
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body,
    });
    const j = await r.json();
    return !!j.success;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { target_user_id, amount_usd, admin_password, turnstile_token, description } = await req.json();
    if (!target_user_id || !amount_usd || !admin_password || !turnstile_token) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const amt = Number(amount_usd);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 100000) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ok = await verifyTurnstile(turnstile_token);
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Verification failed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !user?.email) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify admin role
    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Re-verify password
    const verifier = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { error: pwErr } = await verifier.auth.signInWithPassword({ email: user.email, password: admin_password });
    if (pwErr) {
      return new Response(JSON.stringify({ error: 'Password incorrect' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reference = `admin-credit-${user.id.slice(0, 8)}-${Date.now()}`;
    const desc = description || `Admin top-up by ${user.email}`;

    const { data: result, error: rpcErr } = await admin.rpc('process_deposit', {
      p_reference_id: reference,
      p_user_id: target_user_id,
      p_amount: amt,
      p_payment_method: 'admin_credit',
      p_description: desc,
    });

    if (rpcErr) {
      return new Response(JSON.stringify({ error: 'Credit failed: ' + rpcErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
