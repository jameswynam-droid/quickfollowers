import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadTickets = (userId: string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!userId) return;

    try {
      // Get all user's tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("id")
        .eq("user_id", userId);

      if (ticketsError || !tickets?.length) {
        setUnreadCount(0);
        return;
      }

      const ticketIds = tickets.map(t => t.id);

      // Get last read times for each ticket
      const { data: reads } = await supabase
        .from("ticket_reads")
        .select("ticket_id, last_read_at")
        .eq("user_id", userId)
        .in("ticket_id", ticketIds);

      const readMap = new Map(reads?.map(r => [r.ticket_id, r.last_read_at]) || []);

      // Count unread admin replies across all tickets
      let total = 0;
      for (const ticketId of ticketIds) {
        const lastRead = readMap.get(ticketId);
        
        let query = supabase
          .from("ticket_messages")
          .select("id", { count: "exact", head: true })
          .eq("ticket_id", ticketId)
          .eq("is_admin_reply", true);

        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }

        const { count } = await query;
        total += count || 0;
      }

      setUnreadCount(total);
    } catch (error) {
      console.error("Error fetching unread tickets:", error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to new ticket messages
    const channel = supabase
      .channel('ticket-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unreadCount, refreshUnread: fetchUnreadCount };
};
