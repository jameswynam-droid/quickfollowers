import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/utils/serviceOrganizer";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";

const Orders = () => {
  useNoIndex(); // Prevent search engine indexing
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      // Sync order statuses first, then fetch orders
      await syncOrderStatuses();
      await fetchOrders(session.user.id);
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    }
  };

  const syncOrderStatuses = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-order-status');
      if (error) {
        console.error("Error syncing order statuses:", error);
      } else {
        console.log("Order status sync:", data);
      }
    } catch (error) {
      console.error("Error syncing order statuses:", error);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncOrderStatuses();
      await fetchOrders(user.id);
      toast.success("Orders refreshed");
    } catch (error) {
      toast.error("Failed to refresh orders");
    } finally {
      setSyncing(false);
    }
  };

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, services(name, category)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default";
      case "processing":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return <FullPageLoader message="Loading orders..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">Order History</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">View all your past orders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Refresh Status'}</span>
              <span className="sm:hidden">{syncing ? '...' : 'Refresh'}</span>
            </Button>
            <Button size="sm" onClick={() => navigate("/services")}>
              <span className="hidden sm:inline">New Order</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Button onClick={() => navigate("/services")}>Browse Services</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">All Orders ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="w-full">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-sm w-[25%] sm:w-auto">Service</TableHead>
                      <TableHead className="text-[10px] sm:text-sm w-[25%] sm:w-auto">Link</TableHead>
                      <TableHead className="text-[10px] sm:text-sm w-[12%] sm:w-auto">Qty</TableHead>
                      <TableHead className="text-[10px] sm:text-sm w-[15%] sm:w-auto">Cost</TableHead>
                      <TableHead className="text-[10px] sm:text-sm w-[18%] sm:w-auto">Status</TableHead>
                      <TableHead className="text-[10px] sm:text-sm hidden lg:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-[10px] sm:text-sm truncate p-1 sm:p-4">
                          {order.services?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-[10px] sm:text-sm truncate p-1 sm:p-4">
                          <span className="block truncate max-w-full">{order.link}</span>
                        </TableCell>
                        <TableCell className="text-[10px] sm:text-sm p-1 sm:p-4">
                          {order.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[10px] sm:text-sm font-semibold p-1 sm:p-4">
                          ₦{formatPrice(order.charge)}
                        </TableCell>
                        <TableCell className="p-1 sm:p-4">
                          <Badge variant={getStatusColor(order.status)} className="text-[8px] sm:text-xs px-1 sm:px-2">
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Orders;
