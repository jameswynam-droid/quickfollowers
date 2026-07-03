import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOTP_REPROMPT_HOURS = 12;

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return false;
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
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
    const { email, password, turnstile_token, totp_code } = await req.json();
    if (!email || !password || !turnstile_token) {
      return new Response(JSON.stringify({ error: 'Missing credentials or verification' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || undefined;
    const ok = await verifyTurnstile(turnstile_token, ip);
    if (!ok) return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.session || !signIn.user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Must be admin OR support
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', signIn.user.id);
    const roleList = (roles || []).map((r: any) => r.role);
    const isStaff = roleList.includes('admin') || roleList.includes('support');
    if (!isStaff) {
      await supabase.auth.signOut();
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const primaryRole = roleList.includes('admin') ? 'admin' : 'support';

    // TOTP: required for support always after enrollment; also re-prompt every 12h even if verified
    const { data: totp } = await admin
      .from('admin_totp')
      .select('secret, verified, last_verified_at')
      .eq('user_id', signIn.user.id)
      .maybeSingle();

    // Support MUST enroll TOTP before first-time full access
    if (primaryRole === 'support' && (!totp || !totp.verified)) {
      // Allow session but signal must_enroll_totp on client-side
      return new Response(JSON.stringify({
        success: true,
        must_enroll_totp: true,
        session: signIn.session,
        user: { id: signIn.user.id, email: signIn.user.email },
        role: primaryRole,
        admin_expires_at: Date.now() + 30 * 60 * 1000, // 30 min grace to enroll
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (totp?.verified) {
      const lastVerified = totp.last_verified_at ? new Date(totp.last_verified_at).getTime() : 0;
      const hoursSince = (Date.now() - lastVerified) / (1000 * 60 * 60);
      const needsCode = hoursSince >= TOTP_REPROMPT_HOURS;

      if (needsCode) {
        if (!totp_code) {
          await supabase.auth.signOut();
          return new Response(JSON.stringify({ error: 'TOTP required', requires_totp: true }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!/^\d{6}$/.test(totp_code)) {
          await supabase.auth.signOut();
          return new Response(JSON.stringify({ error: 'Invalid code format', requires_totp: true }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const t = new OTPAuth.TOTP({ issuer: 'QuickFollowers', label: signIn.user.email || 'admin', secret: OTPAuth.Secret.fromBase32(totp.secret) });
        const delta = t.validate({ token: totp_code, window: 1 });
        if (delta === null) {
          await supabase.auth.signOut();
          return new Response(JSON.stringify({ error: 'Incorrect authenticator code', requires_totp: true }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await admin.from('admin_totp').update({ last_verified_at: new Date().toISOString() }).eq('user_id', signIn.user.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session: signIn.session,
      user: { id: signIn.user.id, email: signIn.user.email },
      role: primaryRole,
      admin_expires_at: Date.now() + 4 * 60 * 60 * 1000,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Login failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
