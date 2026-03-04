import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useCurrency } from "@/hooks/useCurrency";

const Dashboard = () => {
  useNoIndex();
  const { formatPrice } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    
    // Check for payment status
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success("Payment successful! Your balance has been updated.");
      window.history.replaceState({}, '', '/dashboard');
    } else if (paymentStatus === 'failed') {
      toast.error("Payment failed. Please try again.");
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await Promise.all([
      fetchProfile(session.user.id),
      fetchOrders(session.user.id),
      checkAdminStatus(session.user.id)
    ]);
    setIsLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data);
  };

  const fetchOrders = async (userId: string) => {
    const { data } = await supabase.from("orders").select("*, services(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    setOrders(data || []);
    
    const { count } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("user_id", userId);
    setTotalOrders(count || 0);
  };

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
  };

  const handlePaymentRequest = async () => {
    if (!paymentAmount || !bankDetails) return toast.error("Fill all fields");
    const { error } = await supabase.from("payments").insert({ user_id: user.id, amount: parseFloat(paymentAmount), bank_details: bankDetails, notes });
    if (error) return toast.error("Failed to submit");
    toast.success("Payment request submitted!");
    setPaymentDialogOpen(false);
  };

  // Get greeting based on user's timezone
  const getGreeting = () => {
    try {
      // Get current hour in user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: userTimezone,
      });
      const hour = parseInt(formatter.format(now), 10);
      
      if (hour >= 5 && hour < 12) {
        return "Good morning";
      } else if (hour >= 12 && hour < 17) {
        return "Good afternoon";
      } else if (hour >= 17 && hour < 21) {
        return "Good evening";
      } else {
        return "Hi";
      }
    } catch {
      // Fallback if timezone detection fails
      return "Hi";
    }
  };

  const displayName = profile?.username || profile?.full_name || user?.email?.split('@')[0] || user?.email;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl sm:text-4xl font-bold">Dashboard</h1>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                Admin
              </Button>
            )}
          </div>
          <p className="mt-3 sm:mt-4 text-lg sm:text-xl">
            {getGreeting()}, <span className="font-semibold text-primary">{displayName}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="col-span-1">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-3xl font-bold truncate">
                {formatPrice(parseFloat(profile?.balance || 0))}
              </div>
              <Button className="w-full mt-3 sm:mt-4 text-xs sm:text-sm" size="sm" onClick={() => navigate("/add-funds")}>
                <Wallet className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />Add Funds
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-3xl font-bold">{totalOrders}</div>
              <Button className="w-full mt-3 sm:mt-4 text-xs sm:text-sm" size="sm" variant="outline" onClick={() => navigate("/orders")}>
                View All
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">History</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <p className="text-muted-foreground text-xs mb-2 sm:mb-4 hidden sm:block">Deposits & refunds</p>
              <Button className="w-full mt-0 sm:mt-4 text-xs sm:text-sm" size="sm" variant="outline" onClick={() => navigate("/transactions")}>
                View
              </Button>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <Button className="w-full mt-0 sm:mt-4 text-xs sm:text-sm" size="sm" onClick={() => navigate("/services")}>
                New Order
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {orders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Service</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Qty</TableHead>
                      <TableHead className="text-xs sm:text-sm">Cost</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">{o.services?.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{o.quantity}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{formatPrice(o.charge)}</TableCell>
                        <TableCell className="text-xs sm:text-sm capitalize">{o.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
      
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
            </div>
            <div>
              <Label>Bank Details</Label>
              <Input value={bankDetails} onChange={e => setBankDetails(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <Button onClick={handlePaymentRequest} className="w-full">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
