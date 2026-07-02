import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const AdminTotpEnroll = () => {
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("admin_totp").select("verified").eq("user_id", user.id).maybeSingle();
    setEnrolled(!!data?.verified);
  };
  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-totp-enroll", { body: {} });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Enroll failed");
      setQr(data.qr_data_url);
      setSecret(data.secret);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const verify = async () => {
    if (!code || code.length !== 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-totp-verify", { body: { code } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Invalid code");
      toast.success("2FA enabled");
      setQr(null); setSecret(null); setCode("");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const disable = async () => {
    if (!confirm("Disable 2FA? Your account will be less secure.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("admin_totp").delete().eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("2FA disabled");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enrolled ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-yellow-500" />}
          Two-Factor Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolled === null ? <p className="text-sm text-muted-foreground">Loading...</p>
          : enrolled ? (
            <>
              <p className="text-sm">2FA is currently <strong>enabled</strong>. Every admin login requires a 6-digit code from your authenticator app.</p>
              <Button variant="destructive" size="sm" onClick={disable}>Disable 2FA</Button>
            </>
          ) : qr ? (
            <>
              <p className="text-sm">Scan this QR code with Google Authenticator, Authy, or 1Password.</p>
              <img src={qr} alt="TOTP QR" className="w-56 h-56 border rounded bg-white p-2" />
              {secret && <p className="text-xs text-muted-foreground">Manual key: <code className="bg-muted px-1 py-0.5 rounded">{secret}</code></p>}
              <div>
                <Label>Enter the 6-digit code from your app</Label>
                <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} inputMode="numeric" className="tracking-widest text-center text-lg" />
              </div>
              <Button onClick={verify} disabled={loading || code.length !== 6}>Verify & Enable</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Protect the admin account with an authenticator-app code required at every login.</p>
              <Button onClick={startEnroll} disabled={loading}>{loading ? "Preparing..." : "Enable 2FA"}</Button>
            </>
          )}
      </CardContent>
    </Card>
  );
};

export default AdminTotpEnroll;
