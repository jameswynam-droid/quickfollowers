import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [notes, setNotes] = useState("");
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
    fetchProfile(session.user.id);
    fetchOrders(session.user.id);
    checkAdminStatus(session.user.id);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data);
  };

  const fetchOrders = async (userId: string) => {
    const { data } = await supabase.from("orders").select("*, services(name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    setOrders(data || []);
  };

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handlePaymentRequest = async () => {
    if (!paymentAmount || !bankDetails) return toast.error("Fill all fields");
    const { error } = await supabase.from("payments").insert({ user_id: user.id, amount: parseFloat(paymentAmount), bank_details: bankDetails, notes });
    if (error) return toast.error("Failed to submit");
    toast.success("Payment request submitted!");
    setPaymentDialogOpen(false);
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Welcome, {profile.full_name || user.email}</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && <Button variant="outline" onClick={() => navigate("/admin")}>Admin</Button>}
            <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card><CardHeader><CardTitle>Balance</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">₦{parseFloat(profile.balance).toFixed(2)}</div><Button className="w-full mt-4" onClick={() => setPaymentDialogOpen(true)}>Add Funds</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Orders</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{orders.length}</div></CardContent></Card>
          <Card><CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader><CardContent><Button className="w-full" onClick={() => navigate("/services")}>Browse Services</Button></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader><CardContent>{orders.length === 0 ? <p className="text-center py-8">No orders yet</p> : <Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Quantity</TableHead><TableHead>Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{orders.map(o => <TableRow key={o.id}><TableCell>{o.services?.name}</TableCell><TableCell>{o.quantity}</TableCell><TableCell>₦{o.charge}</TableCell><TableCell>{o.status}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
      </main>
      <Footer />
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}><DialogContent><DialogHeader><DialogTitle>Bank Transfer</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Amount</Label><Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div><div><Label>Bank Details</Label><Input value={bankDetails} onChange={e => setBankDetails(e.target.value)} /></div><div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div><Button onClick={handlePaymentRequest} className="w-full">Submit</Button></div></DialogContent></Dialog>
    </div>
  );
};

export default Dashboard;
