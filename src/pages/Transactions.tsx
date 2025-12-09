import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import { format } from "date-fns";

const Transactions = () => {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
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
    fetchTransactions(session.user.id);
  };

  const fetchTransactions = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .in("type", ["deposit", "refund"])
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case "refund":
        return <RotateCcw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Deposit</Badge>;
      case "refund":
        return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Refund</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return `+₦${parseFloat(String(amount)).toFixed(2)}`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Transactions</h1>
            <p className="text-muted-foreground mt-2">View your transaction history</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deposits & Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No transactions yet</p>
                <Button onClick={() => navigate("/services")}>Place Your First Order</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(tx.type)}
                          {getTypeBadge(tx.type)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{tx.description}</TableCell>
                      <TableCell className="text-green-500">
                        {formatAmount(tx.amount)}
                      </TableCell>
                      <TableCell>₦{parseFloat(tx.balance_after).toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Transactions;
