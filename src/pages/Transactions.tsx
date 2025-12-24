import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDownCircle, RotateCcw } from "lucide-react";
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
        return <ArrowDownCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />;
      case "refund":
        return <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-xs">Deposit</Badge>;
      case "refund":
        return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-xs">Refund</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{type}</Badge>;
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
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">Transactions</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">View your transaction history</p>
          </div>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Deposits & Refunds</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4 text-sm">No transactions yet</p>
                <Button onClick={() => navigate("/services")}>Place Your First Order</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Description</TableHead>
                      <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Balance</TableHead>
                      <TableHead className="text-xs sm:text-sm">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {getTypeIcon(tx.type)}
                            {getTypeBadge(tx.type)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[200px] truncate hidden sm:table-cell">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-green-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                          {formatAmount(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                          ₦{parseFloat(tx.balance_after).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="hidden sm:inline">{format(new Date(tx.created_at), "MMM d, yyyy")}</span>
                          <span className="sm:hidden">{format(new Date(tx.created_at), "MM/dd")}</span>
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
    </div>
  );
};

export default Transactions;
