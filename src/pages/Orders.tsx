import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/utils/serviceOrganizer";
import { RefreshCw, ExternalLink, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";

const Orders = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = searchQuery === "" || 
        order.services?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.link?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.api_order_id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

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
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <FullPageLoader message="Loading orders..." />;
  }

  return (
    <div className="min-h-screen flex flex-col touch-manipulation">
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
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Refresh'}</span>
              <span className="sm:hidden">{syncing ? '...' : 'Refresh'}</span>
            </Button>
            <Button size="sm" onClick={() => navigate("/services")}>New</Button>
          </div>
        </div>

        {/* Search and Filter */}
        {orders.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service, link, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Button onClick={() => navigate("/services")}>Browse Services</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="touch-manipulation">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">
                {searchQuery || statusFilter !== "all" 
                  ? `Showing ${filteredOrders.length} of ${orders.length} Orders`
                  : `All Orders (${orders.length})`
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {filteredOrders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No orders match your search</p>
                  <Button 
                    variant="link" 
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto touch-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="min-w-[800px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Order ID</TableHead>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="whitespace-nowrap">Service</TableHead>
                          <TableHead className="whitespace-nowrap">Link</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Qty</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Cost</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow 
                            key={order.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                              {order.api_order_id || order.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground text-xs sm:text-sm">
                              {formatDate(order.created_at)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs sm:text-sm max-w-[120px] sm:max-w-[180px] truncate" title={order.services?.name}>
                              {order.services?.name || "Unknown"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs sm:text-sm max-w-[120px] sm:max-w-[200px]">
                              <a 
                                href={order.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate block"
                                onClick={(e) => e.stopPropagation()}
                                title={order.link}
                              >
                                {order.link.length > 25 ? order.link.substring(0, 25) + '...' : order.link}
                              </a>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm">
                              {order.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap font-semibold text-xs sm:text-sm">
                              ₦{formatPrice(order.charge)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant={getStatusColor(order.status)} className="capitalize text-xs">
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 bg-background pb-2 z-10">
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 pb-4">
                {/* Order ID first */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Order ID</p>
                  <p className="font-mono text-sm font-medium">{selectedOrder.api_order_id || selectedOrder.id.slice(0, 8)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDateTime(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={getStatusColor(selectedOrder.status)} className="capitalize mt-1">
                      {selectedOrder.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="font-medium">{selectedOrder.quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-semibold text-primary">₦{formatPrice(selectedOrder.charge)}</p>
                  </div>
                  {selectedOrder.start_count !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Start Count</p>
                      <p className="font-medium">{selectedOrder.start_count?.toLocaleString() || 'N/A'}</p>
                    </div>
                  )}
                  {selectedOrder.remains !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Remains</p>
                      <p className="font-medium">{selectedOrder.remains?.toLocaleString() || '0'}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service</p>
                  <p className="font-medium">{selectedOrder.services?.name || "Unknown"}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Link</p>
                  <div className="bg-muted p-3 rounded-lg break-all">
                    <a 
                      href={selectedOrder.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-start gap-2"
                    >
                      <span className="flex-1">{selectedOrder.link}</span>
                      <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

export default Orders;
