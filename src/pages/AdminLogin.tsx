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



declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const AdminLogin = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (getAdminSession()) {
      navigate("/admin/panel", { replace: true });
    }
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
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }
    const t = setInterval(render, 400);
    return () => {
      clearInterval(t);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please complete the verification");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { email, password, turnstile_token: token },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Login failed");
      }
      // Establish supabase session for subsequent calls
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        user_id: data.user.id,
        email: data.user.email,
        admin_expires_at: data.admin_expires_at,
      }));
      toast.success("Welcome, admin");
      navigate("/admin/panel", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      setToken("");
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch {}
      }
    } finally {
      setLoading(false);
    }
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
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div ref={widgetRef} className="flex justify-center" />
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Verifying..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
