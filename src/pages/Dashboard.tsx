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
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Wallet, ShoppingCart, Clock, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useCurrency } from "@/hooks/useCurrency";
import DailyPopupModal from "@/components/DailyPopupModal";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  processing: "bg-primary/15 text-primary border-primary/20",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  partial: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
};

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
    if (!session) { navigate("/auth"); return; }
    setUser(session.user);
    await Promise.all([fetchProfile(session.user.id), fetchOrders(session.user.id), checkAdminStatus(session.user.id)]);
    setIsLoading(false);
    checkUnreadSupportReplies(session.user.id);
  };

  // One-time-per-session popup if user has unread support replies
  const checkUnreadSupportReplies = async (userId: string) => {
    try {
      const flag = `qf-support-popup-${userId}`;
      if (sessionStorage.getItem(flag)) return;
      const { data: tickets } = await supabase.from("tickets").select("id").eq("user_id", userId);
      if (!tickets?.length) return;
      const ticketIds = tickets.map(t => t.id);
      const [readsRes, msgsRes] = await Promise.all([
        supabase.from("ticket_reads").select("ticket_id, last_read_at").eq("user_id", userId).in("ticket_id", ticketIds),
        supabase.from("ticket_messages").select("ticket_id, created_at").eq("is_admin_reply", true).in("ticket_id", ticketIds),
      ]);
      const readMap = new Map((readsRes.data || []).map((r: any) => [r.ticket_id, r.last_read_at]));
      const unread = (msgsRes.data || []).filter((m: any) => {
        const lr = readMap.get(m.ticket_id);
        return !lr || m.created_at > lr;
      }).length;
      if (unread > 0) {
        sessionStorage.setItem(flag, '1');
        toast.info(`You have ${unread} new repl${unread === 1 ? 'y' : 'ies'} from support`, {
          duration: 8000,
          action: { label: "View", onClick: () => navigate("/tickets") },
        });
      }
    } catch (e) {
      // silent
    }
  };


  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("balance, full_name, username, email").eq("id", userId).single();
    if (data) setProfile(data);
  };

  const fetchOrders = async (userId: string) => {
    const { data } = await supabase.from("orders").select("id, quantity, charge, status, created_at, services(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
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

  const getGreeting = () => {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: userTimezone });
      const hour = parseInt(formatter.format(now), 10);
      if (hour >= 5 && hour < 12) return "Good morning";
      if (hour >= 12 && hour < 17) return "Good afternoon";
      if (hour >= 17 && hour < 21) return "Good evening";
      return "Hi";
    } catch { return "Hi"; }
  };

  const displayName = profile?.username || profile?.full_name || user?.email?.split('@')[0] || user?.email;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8"><DashboardSkeleton /></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5">
              {displayName}
            </h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                Admin Panel
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Balance */}
          <Card className="relative overflow-hidden border-primary/20 group hover:border-primary/40 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 gradient-primary opacity-[0.07] rounded-bl-[40px]" />
            <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold truncate text-foreground">
                {formatPrice(parseFloat(profile?.balance || 0))}
              </div>
              <Button className="w-full mt-3 text-xs sm:text-sm h-9" size="sm" onClick={() => navigate("/add-funds")}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Add Funds
              </Button>
            </CardContent>
          </Card>

          {/* Orders */}
          <Card className="relative overflow-hidden group hover:border-border transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-secondary opacity-[0.07] rounded-bl-[40px]" />
            <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-secondary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold text-foreground">{totalOrders}</div>
              <Button className="w-full mt-3 text-xs sm:text-sm h-9" size="sm" variant="outline" onClick={() => navigate("/orders")}>
                View All <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="relative overflow-hidden group hover:border-border transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-accent opacity-[0.07] rounded-bl-[40px]" />
            <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">History</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-accent" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-1 sm:pt-2">
              <p className="text-muted-foreground text-xs mb-1 hidden sm:block">Deposits & refunds</p>
              <Button className="w-full mt-2 sm:mt-3 text-xs sm:text-sm h-9" size="sm" variant="outline" onClick={() => navigate("/transactions")}>
                View <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="relative overflow-hidden group hover:border-border transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-success opacity-[0.07] rounded-bl-[40px]" />
            <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Quick Start</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-1 sm:pt-2">
              <p className="text-muted-foreground text-xs mb-1 hidden sm:block">Place a new order</p>
              <Button className="w-full mt-2 sm:mt-3 text-xs sm:text-sm h-9" size="sm" onClick={() => navigate("/services")}>
                New Order <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Recent Orders</CardTitle>
            {orders.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/orders")}>
                See all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            {orders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">No orders yet</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/services")}>Place your first order</Button>
              </div>
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
                      <TableRow key={o.id} className="group">
                        <TableCell className="text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">{o.services?.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{o.quantity}</TableCell>
                        <TableCell className="text-xs sm:text-sm font-medium">{formatPrice(o.charge)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] capitalize border ${statusColors[o.status] || ''}`}>
                            {o.status?.replace('_',' ')}
                          </Badge>
                        </TableCell>
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
      <DailyPopupModal />
      
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bank Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Amount</Label><Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
            <div><Label>Bank Details</Label><Input value={bankDetails} onChange={e => setBankDetails(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <Button onClick={handlePaymentRequest} className="w-full">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
