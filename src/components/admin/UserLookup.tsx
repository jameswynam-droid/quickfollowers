import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";



interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  balance: number;
  created_at: string;
}

const UserLookup = () => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string>("user");
  const [orders, setOrders] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [adminPwd, setAdminPwd] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setProfile(null);
    setOrders([]);
    try {
      const q = query.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, balance, created_at")
        .or(`email.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("No user found");
        return;
      }
      setProfile(data as Profile);
      const [{ data: roleData }, { data: orderData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.id).maybeSingle(),
        supabase.from("orders").select("id, service_name, charge, status, quantity, created_at").eq("user_id", data.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setRole(roleData?.role || "user");
      setOrders(orderData || []);
    } catch (e: any) {
      toast.error(e.message || "Lookup failed");
    } finally {
      setSearching(false);
    }
  };

  const openAddFunds = async () => {
    setAmount("");
    setAdminPwd("");
    setTurnstileToken("");
    setAddOpen(true);
    let siteKey = "";
    try {
      const { data } = await supabase.functions.invoke("admin-login", { method: "GET" });
      siteKey = data?.site_key || "";
    } catch {}
    if (!siteKey) return;
    if (!document.getElementById("cf-turnstile-script")) {
      const s = document.createElement("script");
      s.id = "cf-turnstile-script";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    const tryRender = () => {
      const el = document.getElementById("admin-credit-turnstile");
      if (el && (window as any).turnstile) {
        el.innerHTML = "";
        try {
          (window as any).turnstile.render(el, {
            sitekey: siteKey,
            callback: (t: string) => setTurnstileToken(t),
            theme: "auto",
          });
        } catch {}
        return true;
      }
      return false;
    };
    let attempts = 0;
    const iv = setInterval(() => {
      if (tryRender() || ++attempts > 20) clearInterval(iv);
    }, 200);
  };

  const submitCredit = async () => {
    if (!profile) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (!adminPwd) {
      toast.error("Enter your admin password");
      return;
    }
    if (!turnstileToken) {
      toast.error("Complete the verification");
      return;
    }
    setCrediting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-credit-user", {
        body: {
          target_user_id: profile.id,
          amount_usd: amt,
          admin_password: adminPwd,
          turnstile_token: turnstileToken,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed");
      }
      toast.success(`Credited ${amt} to ${profile.email}`);
      setAddOpen(false);
      search();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setCrediting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by email or username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button onClick={search} disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{profile.full_name || profile.username || profile.email}</span>
              <Badge variant={role === "admin" ? "default" : "secondary"}>{role}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Email:</span> {profile.email}</div>
              <div><span className="text-muted-foreground">Username:</span> {profile.username || "—"}</div>
              <div><span className="text-muted-foreground">Balance:</span> ${Number(profile.balance).toFixed(2)}</div>
              <div><span className="text-muted-foreground">Signed up:</span> {new Date(profile.created_at).toLocaleDateString()}</div>
            </div>
            <Button onClick={openAddFunds} size="sm">Add Funds</Button>
          </CardContent>
        </Card>
      )}

      {profile && orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="max-w-[200px] truncate">{o.service_name}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>${Number(o.charge).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                      <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds to {profile?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm your admin password</Label>
              <Input type="password" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} />
            </div>
            <div id="admin-credit-turnstile" className="flex justify-center" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitCredit} disabled={crediting || !turnstileToken}>
              {crediting ? "Processing..." : "Credit User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserLookup;
