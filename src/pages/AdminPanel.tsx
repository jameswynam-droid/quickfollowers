import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { AdminNotifications } from "@/components/AdminNotifications";
import { AdminBellNotifications } from "@/components/AdminBellNotifications";
import { AdminFloatingBellNotifications } from "@/components/AdminFloatingBellNotifications";
import { AdminDailyPopups } from "@/components/AdminDailyPopups";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminGuard, { clearAdminSession } from "@/components/admin/AdminGuard";
import UserLookup from "@/components/admin/UserLookup";

const AdminPanelInner = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      fetchPendingPayments();
    })();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select("id, user_id, amount, status, bank_details, notes, proof_url, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const withProfiles = await Promise.all(
        (paymentsData || []).map(async (p) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", p.user_id)
            .maybeSingle();
          return { ...p, profiles: profile || { email: "Unknown", full_name: null } };
        })
      );
      setPayments(withProfiles);
    } catch (e: any) {
      toast.error("Failed to load payments: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId: string, approved: boolean) => {
    try {
      const { error } = await supabase.functions.invoke("approve-payment", {
        body: { payment_id: paymentId, approved },
      });
      if (error) throw error;
      toast.success(`Payment ${approved ? "approved" : "rejected"}`);
      fetchPendingPayments();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const syncServices = async () => {
    try {
      toast.info("Syncing services...");
      const { error } = await supabase.functions.invoke("sync-services");
      if (error) throw error;
      toast.success("Services synced");
    } catch {
      toast.error("Sync failed");
    }
  };

  const handleLogout = async () => {
    clearAdminSession();
    await supabase.auth.signOut();
    navigate("/admin", { replace: true });
  };

  if (loading) return <FullPageLoader message="Loading admin panel..." />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/tickets")} variant="outline" size="sm">Tickets</Button>
            <Button onClick={syncServices} size="sm" variant="outline">Sync Services</Button>
            <Button onClick={handleLogout} size="sm" variant="ghost">Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="users">User Lookup</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="notifications">Service Alerts</TabsTrigger>
            <TabsTrigger value="bell">Header Bell</TabsTrigger>
            <TabsTrigger value="floating">Info Bell</TabsTrigger>
            <TabsTrigger value="popups">Pop-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserLookup />
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader><CardTitle>Pending Payments</CardTitle></CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pending payments</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.profiles?.email}</TableCell>
                            <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{p.notes || "—"}</TableCell>
                            <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleApprove(p.id, true)}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleApprove(p.id, false)}>Reject</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications"><AdminNotifications userId={user?.id} /></TabsContent>
          <TabsContent value="bell"><AdminBellNotifications /></TabsContent>
          <TabsContent value="floating"><AdminFloatingBellNotifications /></TabsContent>
          <TabsContent value="popups"><AdminDailyPopups /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const AdminPanel = () => (
  <AdminGuard>
    <AdminPanelInner />
  </AdminGuard>
);

export default AdminPanel;
