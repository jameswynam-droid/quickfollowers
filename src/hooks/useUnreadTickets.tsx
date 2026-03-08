import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadTickets = (userId: string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 30000; // 30 seconds minimum between fetches

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;

    // Throttle fetches
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_FETCH_INTERVAL) return;
    lastFetchRef.current = now;

    try {
      // Single query: get all admin replies with their ticket info
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id")
        .eq("user_id", userId);

      if (!tickets?.length) {
        setUnreadCount(0);
        return;
      }

      const ticketIds = tickets.map(t => t.id);

      // Get reads and unread messages in parallel (just 2 queries instead of N+1)
      const [readsResult, messagesResult] = await Promise.all([
        supabase
          .from("ticket_reads")
          .select("ticket_id, last_read_at")
          .eq("user_id", userId)
          .in("ticket_id", ticketIds),
        supabase
          .from("ticket_messages")
          .select("ticket_id, created_at")
          .eq("is_admin_reply", true)
          .in("ticket_id", ticketIds)
      ]);

      const readMap = new Map(readsResult.data?.map(r => [r.ticket_id, r.last_read_at]) || []);

      // Count unread in memory instead of N separate queries
      const total = (messagesResult.data || []).filter(msg => {
        const lastRead = readMap.get(msg.ticket_id);
        return !lastRead || msg.created_at > lastRead;
      }).length;

      setUnreadCount(total);
    } catch (error) {
      console.error("Error fetching unread tickets:", error);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe only to admin replies (filter by is_admin_reply)
    const channel = supabase
      .channel('ticket-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
      }, () => {
        // Reset throttle on new message so it fetches
        lastFetchRef.current = 0;
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  return { unreadCount, refreshUnread: fetchUnreadCount };
};
