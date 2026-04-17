import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { OrdersSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useCurrency } from "@/hooks/useCurrency";

const Orders = () => {
  useNoIndex();
  const { formatPrice } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
          } else if (payload.eventType === 'INSERT') {
            fetchOrders(user.id);
          }
        }
      ).subscribe();

    const startTimeout = setTimeout(() => syncOrderStatuses(), 2000);
    const syncInterval = setInterval(() => syncOrderStatuses(), 30000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') syncOrderStatuses(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(startTimeout);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      await fetchOrders(session.user.id);
    } catch (error) { console.error("Auth check error:", error); navigate("/auth"); }
  };

  const syncOrderStatuses = async () => {
    try { await supabase.functions.invoke('sync-order-status'); } catch {}
  };

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, api_order_id, link, quantity, charge, status, remains, start_count, created_at, services(name, category)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) { console.error("Error fetching orders:", error); }
    finally { setLoading(false); }
  };

  const handleReorder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error("Order not found");
      return;
    }
    // Navigate to New Order with the same service preselected (link/qty empty)
    navigate(`/services?serviceId=${encodeURIComponent(order.service_id || order.services?.id || "")}`);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed": return "default";
      case "processing": return "secondary";
      case "pending": return "outline";
      case "partial": return "secondary";
      case "cancelled": case "failed": return "destructive";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8"><OrdersSkeleton /></main>
        <Footer />
      </div>
    );
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
          <Button size="sm" onClick={() => navigate("/services")}>New Order</Button>
        </div>

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
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No orders match your search</p>
                  <Button variant="link" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>Clear filters</Button>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer hover:bg-muted/50 transition" onClick={() => setSelectedOrder(order)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">{order.services?.name || "Unknown"}</p>
                        <Badge variant={getStatusColor(order.status)} className="capitalize text-xs shrink-0">{order.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(order.created_at)}</span>
                        <span>Qty: {order.quantity.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">{order.api_order_id || order.id.slice(0, 8)}</span>
                        <span className="font-semibold text-sm text-primary">{formatPrice(order.charge)}</span>
                      </div>
                      {(order.status === 'completed' || order.status === 'cancelled') && (
                        <Button
                          variant="outline" size="sm" className="w-full h-8 text-xs mt-1"
                          onClick={(e) => handleReorder(order.id, e)}
                          disabled={actionLoading === order.id}
                        >
                          {actionLoading === order.id ? '...' : 'Re-order'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop table view */}
            <Card className="hidden sm:block touch-manipulation">
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
                    <Button variant="link" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>Clear filters</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto touch-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="min-w-[900px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Order ID</TableHead>
                            <TableHead className="whitespace-nowrap">Date</TableHead>
                            <TableHead className="whitespace-nowrap">Service</TableHead>
                            <TableHead className="whitespace-nowrap">Link</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Qty</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Remains</TableHead>
                            <TableHead className="whitespace-nowrap text-right">Cost</TableHead>
                            <TableHead className="whitespace-nowrap">Status</TableHead>
                            <TableHead className="whitespace-nowrap">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.map((order) => (
                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrder(order)}>
                              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                {order.api_order_id || order.id.slice(0, 8)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground text-xs sm:text-sm">
                                {formatDate(order.created_at)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs sm:text-sm max-w-[180px] truncate" title={order.services?.name}>
                                {order.services?.name || "Unknown"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs sm:text-sm max-w-[200px]">
                                <a href={order.link.startsWith('http') ? order.link : `https://${order.link}`} target="_blank" rel="noreferrer noopener"
                                  className="text-primary hover:underline truncate block" onClick={(e) => e.stopPropagation()} title={order.link}>
                                  {order.link.length > 25 ? order.link.substring(0, 25) + '...' : order.link}
                                </a>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm">{order.quantity.toLocaleString()}</TableCell>
                              <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm text-muted-foreground">
                                {order.remains !== null ? order.remains.toLocaleString() : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-semibold text-xs sm:text-sm">{formatPrice(order.charge)}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge variant={getStatusColor(order.status)} className="capitalize text-xs">{order.status}</Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {(order.status === 'completed' || order.status === 'cancelled') && (
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                                    onClick={(e) => handleReorder(order.id, e)} disabled={actionLoading === order.id}>
                                    {actionLoading === order.id ? '...' : 'Re-order'}
                                  </Button>
                                )}
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
          </>
        )}

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 bg-background pb-2 z-10">
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 pb-4">
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
                    <Badge variant={getStatusColor(selectedOrder.status)} className="capitalize mt-1">{selectedOrder.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="font-medium">{selectedOrder.quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-semibold text-primary">{formatPrice(selectedOrder.charge)}</p>
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
                    <a href={selectedOrder.link.startsWith('http') ? selectedOrder.link : `https://${selectedOrder.link}`}
                      target="_blank" rel="noreferrer noopener" className="text-primary hover:underline flex items-start gap-2">
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
