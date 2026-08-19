import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { OrdersSkeleton } from "@/components/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useCurrency } from "@/hooks/useCurrency";

const statusVariant = (status: string) => {
  if (status === "completed") return "default";
  if (status === "cancelled" || status === "failed") return "destructive";
  return "secondary";
};

const Subscriptions = () => {
  useNoIndex();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const userId = session.user.id;

      const [{ data: parentRows }, { data: reservationRows }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, api_order_id, link, quantity, charge, status, created_at, service_id, services(name, category)")
          .eq("user_id", userId)
          .is("parent_order_id", null)
          .like("link", "@%")
          .order("created_at", { ascending: false }),
        supabase
          .from("subscription_reservations")
          .select("id, order_id, estimated_max, charged_so_far, status, created_at")
          .eq("user_id", userId),
      ]);

      const parentIds = (parentRows || []).map((p: any) => p.id);
      let childRows: any[] = [];
      if (parentIds.length) {
        const { data } = await supabase
          .from("orders")
          .select("id, parent_order_id, api_order_id, charge, status, remains, start_count, created_at")
          .in("parent_order_id", parentIds)
          .order("created_at", { ascending: false });
        childRows = data || [];
      }

      setParents(parentRows || []);
      setReservations(reservationRows || []);
      setChildren(childRows);
      setLoading(false);
    })();
  }, [navigate]);

  const reservationFor = useMemo(() => {
    const map: Record<string, any> = {};
    reservations.forEach((r) => { if (r.order_id) map[r.order_id] = r; });
    return map;
  }, [reservations]);

  const childrenFor = useMemo(() => {
    const map: Record<string, any[]> = {};
    children.forEach((c) => {
      map[c.parent_order_id] = map[c.parent_order_id] || [];
      map[c.parent_order_id].push(c);
    });
    return map;
  }, [children]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto services that watch your profile and deliver to every new post. You are charged only for what is
            actually delivered, and the rest of the hold is returned to your balance.
          </p>
        </div>

        {loading ? (
          <OrdersSkeleton />
        ) : parents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-foreground">You have no subscriptions yet.</p>
              <Button onClick={() => navigate("/services")}>Browse auto services</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {parents.map((p) => {
              const res = reservationFor[p.id];
              const kids = childrenFor[p.id] || [];
              const charged = Number(res?.charged_so_far || 0);
              const held = res?.status === "active"
                ? Math.max(0, Number(res?.estimated_max || 0) - charged)
                : 0;
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base text-foreground">{p.services?.name || p.service_id}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Subscription ID #{p.api_order_id} · {p.link}
                        </p>
                      </div>
                      <Badge variant={statusVariant(p.status)} className="capitalize shrink-0">
                        {p.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Deliveries</p>
                        <p className="font-semibold text-foreground">{kids.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Charged so far</p>
                        <p className="font-semibold text-foreground">{formatPrice(charged)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Still on hold</p>
                        <p className="font-semibold text-foreground">{formatPrice(held)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Started</p>
                        <p className="font-semibold text-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {kids.length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {kids.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium text-foreground">Order #{c.api_order_id}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleString()}
                                {c.remains !== null && c.remains !== undefined ? ` · remaining ${c.remains}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">{formatPrice(Number(c.charge))}</p>
                              <Badge variant={statusVariant(c.status)} className="capitalize mt-1">
                                {c.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Subscriptions;
