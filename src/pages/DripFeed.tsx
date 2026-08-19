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

const DripFeed = () => {
  useNoIndex();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const userId = session.user.id;

      const { data: parentRows } = await supabase
        .from("orders")
        .select("id, api_order_id, link, quantity, charge, status, runs, interval_minutes, created_at, service_id, services(name, category)")
        .eq("user_id", userId)
        .is("parent_order_id", null)
        .gt("runs", 1)
        .order("created_at", { ascending: false });

      const parentIds = (parentRows || []).map((p: any) => p.id);
      let childRows: any[] = [];
      if (parentIds.length) {
        const { data } = await supabase
          .from("orders")
          .select("id, parent_order_id, api_order_id, status, remains, start_count, created_at")
          .in("parent_order_id", parentIds)
          .order("created_at", { ascending: true });
        childRows = data || [];
      }

      setParents(parentRows || []);
      setChildren(childRows);
      setLoading(false);
    })();
  }, [navigate]);

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
          <h1 className="text-2xl font-black text-foreground">Drip Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orders split into timed runs so delivery looks natural. The full amount is charged once when the order is
            placed, then each run is delivered on schedule.
          </p>
        </div>

        {loading ? (
          <OrdersSkeleton />
        ) : parents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-foreground">You have no drip feed orders yet.</p>
              <Button onClick={() => navigate("/services")}>Place a drip feed order</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {parents.map((p) => {
              const kids = childrenFor[p.id] || [];
              const perRun = p.runs ? Math.round(Number(p.quantity) / Number(p.runs)) : p.quantity;
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base text-foreground">{p.services?.name || p.service_id}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          Order #{p.api_order_id} · {p.link}
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
                        <p className="text-xs text-muted-foreground">Runs</p>
                        <p className="font-semibold text-foreground">
                          {kids.filter((c) => c.status === "completed").length} / {p.runs}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Per run</p>
                        <p className="font-semibold text-foreground">{perRun}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Interval</p>
                        <p className="font-semibold text-foreground">{p.interval_minutes} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total charged</p>
                        <p className="font-semibold text-foreground">{formatPrice(Number(p.charge))}</p>
                      </div>
                    </div>

                    {kids.length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {kids.map((c, i) => (
                          <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium text-foreground">Run {i + 1} · #{c.api_order_id}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleString()}
                                {c.remains !== null && c.remains !== undefined ? ` · remaining ${c.remains}` : ""}
                              </p>
                            </div>
                            <Badge variant={statusVariant(c.status)} className="capitalize">
                              {c.status.replace("_", " ")}
                            </Badge>
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

export default DripFeed;
