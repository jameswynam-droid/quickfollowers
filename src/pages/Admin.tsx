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
import { AdminFloatingBellNotifications } from "@/components/AdminFloatingBellNotifications";
import { AdminDailyPopups } from "@/components/AdminDailyPopups";
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
        .select("id, user_id, amount, status, bank_details, notes, proof_url, created_at")
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

        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="notifications">Service Alerts</TabsTrigger>
            <TabsTrigger value="bell">Header Bell</TabsTrigger>
            <TabsTrigger value="floating">Info Bell</TabsTrigger>
            <TabsTrigger value="popups">Pop-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <AdminNotifications userId={user?.id} />
          </TabsContent>

          <TabsContent value="bell">
            <AdminBellNotifications />
          </TabsContent>

          <TabsContent value="floating">
            <AdminFloatingBellNotifications />
          </TabsContent>

          <TabsContent value="popups">
            <AdminDailyPopups />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
