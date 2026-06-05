import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects whether the current user has any drip-feed and/or subscription orders.
 * Used to conditionally reveal the Drip Feed and Subscriptions navigation links.
 *
 * Classification (without schema changes):
 *  - drip-feed:     orders.runs IS NOT NULL AND runs > 1
 *  - subscription:  orders.link starts with '@' (place-order writes "@username" for auto-services)
 */
export const useOrderKinds = (userId: string | null | undefined) => {
  const [hasDripFeed, setHasDripFeed] = useState(false);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHasDripFeed(false);
      setHasSubscriptions(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [dripRes, subRes] = await Promise.all([
        supabase.from("orders").select("id", { head: true, count: "exact" }).eq("user_id", userId).gt("runs", 1).limit(1),
        supabase.from("orders").select("id", { head: true, count: "exact" }).eq("user_id", userId).like("link", "@%").limit(1),
      ]);
      if (cancelled) return;
      setHasDripFeed((dripRes.count ?? 0) > 0);
      setHasSubscriptions((subRes.count ?? 0) > 0);
    };
    load();

    const channel = supabase
      .channel(`order-kinds-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const o = payload.new;
          if (o?.runs && o.runs > 1) setHasDripFeed(true);
          if (typeof o?.link === "string" && o.link.startsWith("@")) setHasSubscriptions(true);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { hasDripFeed, hasSubscriptions };
};
