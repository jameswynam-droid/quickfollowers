import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { AdminNotifications } from "@/components/AdminNotifications";
import { AdminBellNotifications } from "@/components/AdminBellNotifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Admin = () => {
  useNoIndex(); // Prevent search engine indexing
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      toast.error("Access denied: Admin only");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    fetchPendingPayments();
  };

  const fetchPendingPayments = async () => {
    try {
      // First get payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Then get profiles for each payment
      const paymentsWithProfiles = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", payment.user_id)
            .maybeSingle();
          
          return {
            ...payment,
            profiles: profile || { email: "Unknown", full_name: null }
          };
        })
      );

      setPayments(paymentsWithProfiles);
    } catch (error: any) {
      console.error("Error loading payments:", error);
      toast.error("Failed to load payments: " + error.message);
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
    } catch (error: any) {
      toast.error(error.message || "Failed to process payment");
    }
  };

  const syncServices = async () => {
    try {
      toast.info("Syncing services from API...");
      const { error } = await supabase.functions.invoke("sync-services");

      if (error) throw error;
      toast.success("Services synced successfully!");
    } catch (error: any) {
      toast.error("Failed to sync services");
    }
  };

  if (loading) {
    return <FullPageLoader message="Loading admin panel..." />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">Admin Panel</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Manage payments, notifications, and services</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/tickets")} variant="outline" size="sm">
              Support Tickets
            </Button>
            <Button onClick={syncServices} size="sm">
              Sync Services
            </Button>
          </div>
        </div>

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="notifications">Service Alerts</TabsTrigger>
            <TabsTrigger value="bell">Bell Notifs</TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Pending Payments</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Review and approve bank transfer requests</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No pending payments</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">User</TableHead>
                          <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Bank</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Notes</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Date</TableHead>
                          <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="text-xs sm:text-sm">
                              <div>
                                <div className="font-medium truncate max-w-[100px] sm:max-w-none">{payment.profiles.full_name || "N/A"}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none">{payment.profiles.email}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap">₦{payment.amount}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[150px] truncate">{payment.bank_details || "N/A"}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell max-w-[150px] truncate">{payment.notes || "N/A"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              {new Date(payment.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 sm:gap-2">
                                <Button
                                  size="sm"
                                  className="text-xs px-2 sm:px-3"
                                  onClick={() => handleApprove(payment.id, true)}
                                >
                                  <span className="hidden sm:inline">Approve</span>
                                  <span className="sm:hidden">✓</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs px-2 sm:px-3"
                                  onClick={() => handleApprove(payment.id, false)}
                                >
                                  <span className="hidden sm:inline">Reject</span>
                                  <span className="sm:hidden">✗</span>
                                </Button>
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

          <TabsContent value="notifications">
            <AdminNotifications userId={user?.id} />
          </TabsContent>

          <TabsContent value="bell">
            <AdminBellNotifications />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
