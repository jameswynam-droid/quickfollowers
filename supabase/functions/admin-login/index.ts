import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return false;
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
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

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ site_key: Deno.env.get('TURNSTILE_SITE_KEY') ?? '' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, password, turnstile_token } = await req.json();
    if (!email || !password || !turnstile_token) {
      return new Response(JSON.stringify({ error: 'Missing credentials or verification' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || undefined;
    const ok = await verifyTurnstile(turnstile_token, ip);
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.session || !signIn.user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', signIn.user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session: signIn.session,
      user: { id: signIn.user.id, email: signIn.user.email },
      admin_expires_at: Date.now() + 4 * 60 * 60 * 1000,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
