import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { ADMIN_SESSION_KEY, getAdminSession } from "@/components/admin/AdminGuard";
import { getFunctionErrorMessage } from "@/lib/functionErrors";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: any) => string; reset: (id?: string) => void; remove: (id?: string) => void; };
  }
}

const AdminLogin = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (getAdminSession()) navigate("/admin/panel", { replace: true });
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("admin-login", { method: "GET" });
        if (data?.site_key) setSiteKey(data.site_key);
      } catch {}
    })();
  }, [navigate]);

  useEffect(() => {
    if (!siteKey) return;
    const id = "cf-turnstile-script";
    let s = document.getElementById(id) as HTMLScriptElement | null;
    const render = () => {
      if (!window.turnstile || !widgetRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "error-callback": () => setToken(""),
        "expired-callback": () => setToken(""),
        theme: "auto",
      });
    };
    if (!s) {
      s = document.createElement("script");
      s.id = id;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else render();
    const t = setInterval(render, 400);
    return () => {
      clearInterval(t);
      if (widgetIdRef.current && window.turnstile) { try { window.turnstile.remove(widgetIdRef.current); } catch {} widgetIdRef.current = null; }
    };
  }, [siteKey]);

  const resetTurnstile = () => {
    setToken("");
    if (widgetIdRef.current && window.turnstile) { try { window.turnstile.reset(widgetIdRef.current); } catch {} }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error("Please complete the verification"); return; }
    setLoading(true);
    try {
      const body: any = { email, password, turnstile_token: token };
      if (needsTotp) body.totp_code = totpCode;
      const { data, error } = await supabase.functions.invoke("admin-login", { body });
      if (data?.requires_totp) {
        setNeedsTotp(true);
        const message = data.error || "Enter your authenticator code";
        if (needsTotp) toast.error(message);
        else toast.info(message);
        resetTurnstile();
        setLoading(false);
        return;
      }
      if (error || !data?.success) throw new Error(await getFunctionErrorMessage(error, data, "Login failed. Please check your details and try again."));
      await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        user_id: data.user.id,
        email: data.user.email,
        role: data.role || "admin",
        admin_expires_at: data.admin_expires_at,
        must_enroll_totp: !!data.must_enroll_totp,
      }));
      toast.success(data.must_enroll_totp ? "Please set up 2FA to continue" : "Welcome");
      navigate("/admin/panel", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      resetTurnstile();
      setTotpCode("");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Admin Sign In</h1>
          <p className="text-xs text-muted-foreground">Restricted access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required disabled={needsTotp} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={needsTotp} />
          </div>
          {needsTotp && (
            <div className="space-y-1.5">
              <Label htmlFor="totp">Authenticator code</Label>
              <Input id="totp" inputMode="numeric" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="tracking-widest text-center text-lg" autoFocus required />
            </div>
          )}
          <div ref={widgetRef} className="flex justify-center" />
          <Button type="submit" className="w-full" disabled={loading || !token || (needsTotp && totpCode.length !== 6)}>
            {loading ? "Verifying..." : needsTotp ? "Verify Code" : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
