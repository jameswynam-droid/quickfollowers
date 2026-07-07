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
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const j = await r.json();
    return !!j.success;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json(401, { error: 'Not signed in.' });

    const { target_user_id, amount_usd, admin_password, turnstile_token, description, mode } = await req.json();
    // mode: 'add' (default) | 'deduct' | 'set'
    const action: 'add' | 'deduct' | 'set' = mode === 'deduct' || mode === 'set' ? mode : 'add';

    if (!target_user_id || amount_usd === undefined || !admin_password || !turnstile_token) {
      return json(400, { error: 'Missing required fields.' });
    }
    const amt = Number(amount_usd);
    if (!Number.isFinite(amt) || amt < 0 || amt > 100000) {
      return json(400, { error: 'Invalid amount.' });
    }
    if (action !== 'set' && amt <= 0) {
      return json(400, { error: 'Amount must be greater than zero.' });
    }

    const ok = await verifyTurnstile(turnstile_token);
    if (!ok) return json(403, { error: 'Verification failed. Please retry.' });

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
    if (userErr || !user?.email) return json(401, { error: 'Not signed in.' });

    const { data: role } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) return json(403, { error: 'Only admins can edit balances.' });

    const verifier = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { error: pwErr } = await verifier.auth.signInWithPassword({ email: user.email, password: admin_password });
    if (pwErr) return json(401, { error: 'Password incorrect.' });

    // Load current balance
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('balance')
      .eq('id', target_user_id)
      .maybeSingle();
    if (targetErr || !target) return json(404, { error: 'User not found.' });

    const currentBalance = Number(target.balance) || 0;
    let delta = 0;
    let txnType: 'deposit' | 'refund' = 'deposit';
    let defaultDesc = '';

    if (action === 'add') {
      delta = amt;
      txnType = 'deposit';
      defaultDesc = `Admin top-up by ${user.email}`;
    } else if (action === 'deduct') {
      delta = -amt;
      txnType = 'refund'; // shown as adjustment in history; keeps existing UI filters happy
      defaultDesc = `Admin deduction by ${user.email}`;
      if (currentBalance + delta < 0) {
        return json(400, { error: `Cannot deduct: user balance is only ${currentBalance}.` });
      }
    } else { // set
      delta = amt - currentBalance;
      if (delta === 0) return json(400, { error: 'New balance is the same as the current balance.' });
      txnType = delta > 0 ? 'deposit' : 'refund';
      defaultDesc = `Admin balance set to ${amt} by ${user.email}`;
    }

    const desc = description || defaultDesc;
    const newBalance = currentBalance + delta;
    const reference = `admin-${action}-${target_user_id.slice(0, 8)}-${Date.now()}`;

    // Update balance
    const { error: updErr } = await admin.from('profiles').update({ balance: newBalance }).eq('id', target_user_id);
    if (updErr) return json(500, { error: 'Balance update failed.' });

    // Insert transaction row
    const { error: txErr } = await admin.from('transactions').insert({
      user_id: target_user_id,
      type: txnType,
      amount: Math.abs(delta),
      balance_after: newBalance,
      description: desc,
      reference_id: reference,
      payment_method: 'admin_credit',
    });
    if (txErr) {
      // Roll back balance if transaction insert fails
      await admin.from('profiles').update({ balance: currentBalance }).eq('id', target_user_id);
      return json(500, { error: 'Could not record transaction.' });
    }

    return json(200, { success: true, new_balance: newBalance, delta });
  } catch (e: any) {
    return json(500, { error: 'Internal error.' });
  }
});
