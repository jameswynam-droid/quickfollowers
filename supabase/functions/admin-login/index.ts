import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as OTPAuth from 'https://esm.sh/otpauth@9.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOTP_REPROMPT_HOURS = 12;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const staffSessionPayload = (signIn: any, role: 'admin' | 'support', mustEnrollTotp = false) => ({
  success: true,
  must_enroll_totp: mustEnrollTotp,
  session: signIn.session,
  user: { id: signIn.user.id, email: signIn.user.email },
  role,
  admin_expires_at: Date.now() + (mustEnrollTotp ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000),
});

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
    return json({ site_key: Deno.env.get('TURNSTILE_SITE_KEY') ?? '' });
  }

  try {
    const { email, password, turnstile_token, totp_code } = await req.json();
    if (!email || !password || !turnstile_token) {
      return json({ success: false, error: 'Enter your email, password, and complete verification.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: 'Staff login is not configured. Please contact the site owner.' }, 500);
    }

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || undefined;
    const ok = await verifyTurnstile(turnstile_token, ip);
    if (!ok) return json({ success: false, error: 'Verification failed. Please refresh the check and try again.' });

    const supabase = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn.session || !signIn.user) {
      return json({ success: false, error: 'Email or password is incorrect.' });
    }

    // Must be admin OR support
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', signIn.user.id);
    const roleList = (roles || []).map((r: any) => r.role);
    const isStaff = roleList.includes('admin') || roleList.includes('support');
    if (!isStaff) {
      await supabase.auth.signOut();
      return json({ success: false, error: 'This account is not allowed to use the staff panel.' });
    }
    const primaryRole = roleList.includes('admin') ? 'admin' : 'support';

    // TOTP: required for support always after enrollment; also re-prompt every 12h even if verified
    const { data: totp } = await admin
      .from('admin_totp')
      .select('secret, verified, last_verified_at')
      .eq('user_id', signIn.user.id)
      .maybeSingle();

    // All staff must enroll TOTP before full access.
    if (!totp || !totp.verified) {
      return json(staffSessionPayload(signIn, primaryRole, true));
    }

    if (totp?.verified) {
      const lastVerified = totp.last_verified_at ? new Date(totp.last_verified_at).getTime() : 0;
      const hoursSince = (Date.now() - lastVerified) / (1000 * 60 * 60);
      const needsCode = hoursSince >= TOTP_REPROMPT_HOURS;

      if (needsCode) {
        if (!totp_code) {
          await supabase.auth.signOut();
          return json({ success: false, error: 'Authenticator code is required.', requires_totp: true });
        }
        if (!/^\d{6}$/.test(totp_code)) {
          await supabase.auth.signOut();
          return json({ success: false, error: 'Enter the 6-digit authenticator code.', requires_totp: true });
        }
        const t = new OTPAuth.TOTP({ issuer: 'QuickFollowers', label: signIn.user.email || 'admin', secret: OTPAuth.Secret.fromBase32(totp.secret) });
        const delta = t.validate({ token: totp_code, window: 1 });
        if (delta === null) {
          await supabase.auth.signOut();
          return json({ success: false, error: 'Incorrect authenticator code. Please try again.', requires_totp: true });
        }
        await admin.from('admin_totp').update({ last_verified_at: new Date().toISOString() }).eq('user_id', signIn.user.id);
      }
    }

    return json(staffSessionPayload(signIn, primaryRole));
  } catch (e) {
    return json({ success: false, error: 'Login could not be completed. Please try again.' }, 500);
  }
});
