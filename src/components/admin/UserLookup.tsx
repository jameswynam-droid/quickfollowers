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
import { useCurrency } from "@/hooks/useCurrency";
import { Search } from "lucide-react";
import { getFunctionErrorMessage } from "@/lib/functionErrors";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  balance: number;
  created_at: string;
}

// Stable, subtle provider hint. Never shows provider names or raw IDs.
function providerHint(seed: string | null | undefined): string {
  if (!seed) return "S-00";
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) % 97;
  return `S-${String(hash + 1).padStart(2, "0")}`;
}

// Payment provider label
function paymentHint(method: string | null | undefined): string {
  if (!method) return "-";
  const m = method.toLowerCase();
  if (m.includes("paystack")) return "PS";
  if (m.includes("flutterwave") || m.includes("flw")) return "FW";
  if (m.includes("kora")) return "KO";
  if (m.includes("admin")) return "MANUAL";
  return method.slice(0, 6).toUpperCase();
}

const UserLookup = ({ isAdmin = true }: { isAdmin?: boolean }) => {
  const { formatPrice, currencySymbol, convertToNGN } = useCurrency();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string>("user");
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orderIdQuery, setOrderIdQuery] = useState("");
  const [activeOrderIdQuery, setActiveOrderIdQuery] = useState("");
  const [transactionIdQuery, setTransactionIdQuery] = useState("");
  const [activeTransactionIdQuery, setActiveTransactionIdQuery] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [balanceMode, setBalanceMode] = useState<"add" | "deduct" | "set">("add");
  const [adminPwd, setAdminPwd] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setProfile(null);
    try {
      const q = query.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, balance, created_at")
        .or(`email.ilike.%${q}%,username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .order("username", { ascending: true })
        .limit(25);
      if (error) throw error;
      const list = (data || []) as Profile[];
      if (list.length === 0) {
        toast.error("No users found");
        return;
      }
      setResults(list);
      if (list.length === 1) {
        void openProfile(list[0]);
      }
    } catch (e: any) {
      toast.error(e.message || "Lookup failed");
    } finally {
      setSearching(false);
    }
  };

  const openProfile = async (p: Profile) => {
    setProfile(p);
    setDetailLoading(true);
    try {
      const [{ data: roleData }, { data: orderData }, { data: txData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", p.id),
        supabase
          .from("orders")
          .select("id, api_order_id, service_id, charge, status, quantity, created_at, services(name, provider, category)")
          .eq("user_id", p.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("transactions")
          .select("id, short_id, type, amount, balance_after, description, payment_method, reference_id, created_at")
          .eq("user_id", p.id)
          .in("type", ["deposit", "refund"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const roleList = (roleData || []).map((r: any) => r.role);
      setRole(roleList.includes("admin") ? "admin" : roleList.includes("support") ? "support" : "user");
      setOrders(orderData || []);
      setTransactions(txData || []);
      setOrderIdQuery("");
      setActiveOrderIdQuery("");
      setTransactionIdQuery("");
      setActiveTransactionIdQuery("");
    } catch (e: any) {
      toast.error(e.message || "Failed to load details");
    } finally {
      setDetailLoading(false);
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
    if (!Number.isFinite(amt) || amt < 0) { toast.error("Invalid amount"); return; }
    if (balanceMode !== "set" && amt <= 0) { toast.error("Enter an amount greater than zero"); return; }
    if (!adminPwd) { toast.error("Enter your admin password"); return; }
    if (!turnstileToken) { toast.error("Complete the verification"); return; }
    const ngnAmount = convertToNGN(amt);
    setCrediting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-credit-user", {
        body: {
          target_user_id: profile.id,
          amount_usd: ngnAmount,
          admin_password: adminPwd,
          turnstile_token: turnstileToken,
          mode: balanceMode,
        },
      });
      if (error || !data?.success) throw new Error(await getFunctionErrorMessage(error, data, "Could not update balance."));
      const verb = balanceMode === "add" ? "Credited" : balanceMode === "deduct" ? "Deducted" : "Set balance to";
      toast.success(`${verb} ${formatPrice(ngnAmount)} for ${profile.email}`);
      setAddOpen(false);
      openProfile(profile);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setCrediting(false);
    }
  };

  const displayedOrders = orders.filter((o) => {
    const q = activeOrderIdQuery.trim().toLowerCase();
    if (!q) return true;
    return [o.api_order_id, o.id, o.id?.slice(0, 8)].some((v) => String(v || "").toLowerCase().includes(q));
  });

  const displayedTransactions = transactions.filter((t) => {
    const q = activeTransactionIdQuery.trim().toLowerCase();
    if (!q) return true;
    return [t.short_id, t.reference_id, t.id, t.id?.slice(0, 8)].some((v) => String(v || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by email, username, or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button onClick={search} disabled={searching}>{searching ? "Searching..." : "Search"}</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 1 && !profile && (
        <Card>
          <CardHeader><CardTitle>{results.length} matches</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => openProfile(r)}
                className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.username || r.full_name || r.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">{formatPrice(Number(r.balance))}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {profile && (
        <>
          {results.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setProfile(null)}>← Back to results</Button>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{profile.full_name || profile.username || profile.email}</span>
                <Badge variant={role === "admin" ? "default" : role === "support" ? "outline" : "secondary"}>{role}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Email:</span> {profile.email}</div>
                <div><span className="text-muted-foreground">Username:</span> {profile.username || "-"}</div>
                <div><span className="text-muted-foreground">Balance:</span> {formatPrice(Number(profile.balance))}</div>
                <div><span className="text-muted-foreground">Signed up:</span> {new Date(profile.created_at).toLocaleDateString()}</div>
              </div>
              {isAdmin && <Button onClick={openAddFunds} size="sm">Add Funds</Button>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Order History</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Search order ID"
                  value={orderIdQuery}
                  onChange={(e) => setOrderIdQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveOrderIdQuery(orderIdQuery)}
                />
                <Button type="button" variant="outline" onClick={() => setActiveOrderIdQuery(orderIdQuery)}>
                  <Search className="mr-2 h-4 w-4" />Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : displayedOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching orders.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Hint</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Charge</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedOrders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">
                            {o.api_order_id || o.id.slice(0, 8)}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{providerHint(`${o.services?.provider || ""}:${o.service_id || ""}`)}</Badge></TableCell>
                          <TableCell className="max-w-[200px] truncate">{o.services?.name || "Unknown service"}</TableCell>
                          <TableCell>{o.quantity}</TableCell>
                          <TableCell>{formatPrice(Number(o.charge))}</TableCell>
                          <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Transaction History</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Search transaction ID"
                  value={transactionIdQuery}
                  onChange={(e) => setTransactionIdQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveTransactionIdQuery(transactionIdQuery)}
                />
                <Button type="button" variant="outline" onClick={() => setActiveTransactionIdQuery(transactionIdQuery)}>
                  <Search className="mr-2 h-4 w-4" />Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : displayedTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching deposits or refunds.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Via</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.short_id || t.reference_id?.slice(0, 10) || t.id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant={t.type === "deposit" ? "default" : t.type === "refund" ? "secondary" : "outline"}>{t.type}</Badge></TableCell>
                          <TableCell>{formatPrice(Number(t.amount))}</TableCell>
                          <TableCell>{formatPrice(Number(t.balance_after))}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{paymentHint(t.payment_method)}</Badge></TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">{t.description || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds to {profile?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount ({currencySymbol})</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {amount && Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Will credit ≈ ₦{convertToNGN(Number(amount)).toLocaleString(undefined, { maximumFractionDigits: 2 })} to their balance.
                </p>
              )}
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
