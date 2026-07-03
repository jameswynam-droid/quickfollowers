import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, UserPlus } from "lucide-react";

interface Staff {
  id: string;
  email: string;
  roles: string[];
  created_at: string;
}

function randomPassword(len = 20) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

const StaffManager = ({ currentUserId }: { currentUserId?: string }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [role, setRole] = useState<"support" | "admin">("support");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "list" },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      setStaff(data.staff || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEmail("");
    setPwd(randomPassword());
    setRole("support");
    setOpen(true);
  };

  const copyPwd = () => {
    navigator.clipboard.writeText(pwd).then(() => toast.success("Password copied"));
  };

  const create = async () => {
    if (!email.trim()) { toast.error("Email required"); return; }
    if (pwd.length < 12) { toast.error("Password must be 12+ characters"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "create", email: email.trim(), password: pwd, role },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      toast.success(`${role === "admin" ? "Admin" : "Support"} account created. Copy the password now — it won't be shown again.`);
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (s: Staff, r: "admin" | "support") => {
    if (!confirm(`Remove ${r} role from ${s.email}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "revoke", user_id: s.id, role: r },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      toast.success("Role removed");
      await load();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const resetPassword = async (s: Staff) => {
    const newPwd = randomPassword();
    if (!confirm(`Reset password for ${s.email}? Their 2FA will also be reset.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "reset_password", user_id: s.id, password: newPwd },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      await navigator.clipboard.writeText(newPwd);
      toast.success(`New password copied to clipboard for ${s.email}`);
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Staff Accounts</CardTitle>
        <Button size="sm" onClick={openCreate}><UserPlus className="h-4 w-4 mr-1" />Add Staff</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && staff.length === 0 && <p className="text-sm text-muted-foreground">No staff yet.</p>}
        {staff.map((s) => (
          <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between border rounded-md p-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{s.email}</p>
              <div className="flex gap-1 mt-1">
                {s.roles.map((r) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => resetPassword(s)}>
                <RefreshCw className="h-3 w-3 mr-1" />Reset PW
              </Button>
              {s.roles.map((r) => (
                s.id === currentUserId && r === "admin" ? null : (
                  <Button key={r} size="sm" variant="ghost" onClick={() => revoke(s, r as any)}>
                    <Trash2 className="h-3 w-3 mr-1" />Remove {r}
                  </Button>
                )
              ))}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@quickfollowers.online" />
            </div>
            <div>
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input value={pwd} onChange={(e) => setPwd(e.target.value)} />
                <Button type="button" size="icon" variant="outline" onClick={() => setPwd(randomPassword())} title="Generate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline" onClick={copyPwd} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Copy this now — it won't be shown again.</p>
            </div>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" variant={role === "support" ? "default" : "outline"} onClick={() => setRole("support")}>Support</Button>
                <Button type="button" size="sm" variant={role === "admin" ? "default" : "outline"} onClick={() => setRole("admin")}>Admin</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {role === "support"
                  ? "Support can reply to tickets, use saved replies, and look up users. Cannot manage blog, pop-ups, or credit balances. Must set up 2FA on first login."
                  : "Full admin — can do everything, including managing other staff."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating…" : "Create Account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StaffManager;
