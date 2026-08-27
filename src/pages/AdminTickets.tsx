import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { enableStaffPush, pushPermission } from "@/lib/staffPush";
import SavedRepliesPicker from "@/components/admin/SavedRepliesPicker";
import { Link } from "react-router-dom";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Paperclip, Send, X, Image, ArrowLeft } from "lucide-react";
import { resolveAttachmentUrl, uploadTicketAttachment } from "@/lib/ticketAttachments";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  unread_count?: number;
}

interface TicketMessage {
  id: string;
  message: string;
  attachment_url: string | null;
  attachment_view_url?: string | null;
  attachment_name: string | null;
  is_admin_reply: boolean;
  created_at: string;
  sender_id: string;
}

const AdminTickets = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<"admin" | "support">("support");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(pushPermission() === "granted");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);

  const setScrollViewport = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const viewport = node.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    scrollViewportRef.current = viewport;
    if (!viewport) return;
    const onScroll = () => {
      const threshold = 80;
      isAtBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const v = scrollViewportRef.current;
    if (!v) return;
    if (force || isAtBottomRef.current) {
      requestAnimationFrame(() => { v.scrollTop = v.scrollHeight; });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`admin-ticket-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
        async (payload) => {
          const m = payload.new as TicketMessage;
          const view = m.attachment_url ? await resolveAttachmentUrl(m.attachment_url) : null;
          setMessages((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, { ...m, attachment_view_url: view }];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  useEffect(() => {
    checkAuth();
  }, []);

  // Realtime: refresh ticket list AND fire browser notification when a new user message arrives
  useEffect(() => {
    if (!isAdmin) return;
    // Request permission once
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const channel = supabase
      .channel('admin-tickets-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, (payload: any) => {
        if (payload.new?.is_admin_reply === false) {
          fetchTickets();
          // Fire browser notification (skip if this user is the message sender)
          try {
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted" &&
              payload.new?.user_id !== user?.id
            ) {
              const n = new Notification("New support message", {
                body: (payload.new?.message || "").slice(0, 140) || "A user replied to a ticket.",
                icon: "/favicon.ico",
                tag: `ticket-${payload.new?.ticket_id}`,
              });
              n.onclick = () => { window.focus(); n.close(); };
            }
          } catch {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user?.id]);


  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/admin", { replace: true });
      return;
    }

    setUser(session.user);

    // Check if user is staff
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "support"]);

    const roleList = (roles || []).map((r: any) => r.role);
    if (!roleList.includes("admin") && !roleList.includes("support")) {
      toast.error("Access denied: staff only");
      navigate("/admin", { replace: true });
      return;
    }

    setStaffRole(roleList.includes("admin") ? "admin" : "support");
    setIsAdmin(true);
    await fetchTickets();
  };

  const fetchTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id;

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (ticketsError) throw ticketsError;

      const ticketIds = (ticketsData || []).map(t => t.id);

      // Batch: admin's read timestamps + all user messages on these tickets
      const [readsRes, msgsRes] = await Promise.all([
        adminId
          ? supabase.from("ticket_reads").select("ticket_id, last_read_at").eq("user_id", adminId).in("ticket_id", ticketIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("ticket_messages").select("ticket_id, created_at").eq("is_admin_reply", false).in("ticket_id", ticketIds),
      ]);
      const readMap = new Map((readsRes.data || []).map((r: any) => [r.ticket_id, r.last_read_at]));
      const unreadByTicket = new Map<string, number>();
      (msgsRes.data || []).forEach((m: any) => {
        const lastRead = readMap.get(m.ticket_id);
        if (!lastRead || m.created_at > lastRead) {
          unreadByTicket.set(m.ticket_id, (unreadByTicket.get(m.ticket_id) || 0) + 1);
        }
      });

      const ticketsWithUsers = await Promise.all(
        (ticketsData || []).map(async (ticket) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", ticket.user_id)
            .maybeSingle();
          return {
            ...ticket,
            user_email: profile?.email || "Unknown",
            user_name: profile?.full_name || null,
            unread_count: unreadByTicket.get(ticket.id) || 0,
          };
        })
      );

      setTickets(ticketsWithUsers);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const rows = data || [];
      const resolved = await Promise.all(
        rows.map(async (m: any) => ({
          ...m,
          attachment_view_url: m.attachment_url ? await resolveAttachmentUrl(m.attachment_url) : null,
        }))
      );
      setMessages(resolved);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const uploadAttachment = (file: File) => uploadTicketAttachment(file, 'admin');

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachment) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    if (!selectedTicket) return;

    setSending(true);
    try {
      let attachmentUrl = null;
      let attachmentName = null;
      if (attachment) {
        attachmentUrl = await uploadAttachment(attachment);
        attachmentName = attachment.name;
      }

      const { error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: newMessage.trim() || (attachment ? "Attached file" : ""),
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          is_admin_reply: true,
        });

      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (selectedTicket.status === 'open') {
        await supabase
          .from("tickets")
          .update({ status: 'in_progress' })
          .eq("id", selectedTicket.id);
        
        setSelectedTicket({ ...selectedTicket, status: 'in_progress' });
      }

      setNewMessage("");
      setAttachment(null);
      isAtBottomRef.current = true;
      await fetchMessages(selectedTicket.id);
      await fetchTickets();
      setTimeout(() => scrollToBottom(true), 50);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) throw error;

      toast.success(`Ticket marked as ${status}`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      await fetchTickets();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    isAtBottomRef.current = true;
    await fetchMessages(ticket.id);
    // Mark ticket as read for the admin
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id;
      if (adminId) {
        const { data: existing } = await supabase
          .from("ticket_reads")
          .select("id")
          .eq("user_id", adminId)
          .eq("ticket_id", ticket.id)
          .maybeSingle();
        if (existing) {
          await supabase.from("ticket_reads").update({ last_read_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("ticket_reads").insert({ user_id: adminId, ticket_id: ticket.id, last_read_at: new Date().toISOString() });
        }
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, unread_count: 0 } : t));
      }
    } catch (e) { /* non-fatal */ }
    setTimeout(() => scrollToBottom(true), 50);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "resolved": return "outline";
      case "closed": return "destructive";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTickets = statusFilter === "all" 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter);

  if (loading) {
    return <FullPageLoader message="Loading tickets..." />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/panel" className="text-sm font-semibold">← Admin Panel</Link>
            <Link to="/admin/messages" className="text-sm font-semibold text-primary">Messages</Link>
          </div>
          <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold">Support Tickets</h1>
              <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage user support requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={pushEnabled ? "secondary" : "outline"}
              size="sm"
              onClick={async () => {
                const r = await enableStaffPush();
                if (r.ok) setPushEnabled(true);
                r.ok ? toast.success(r.message) : toast.error(r.message);
              }}
            >
              {pushEnabled ? "Alerts on" : "Enable alerts"}
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No tickets found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="cursor-pointer hover:bg-muted/50 transition"
                onClick={() => openTicket(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ticket.user_name || ticket.user_email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(ticket.updated_at)}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(ticket.status)} className="capitalize shrink-0">
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    {(ticket.unread_count ?? 0) > 0 && (
                      <Badge variant="destructive" className="shrink-0 min-w-[1.5rem] h-6 px-1.5 flex items-center justify-center text-xs font-semibold">
                        {ticket.unread_count}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Messages Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none flex flex-col p-0 sm:max-w-4xl sm:h-[85vh] sm:rounded-lg [&>button.absolute]:hidden">
            <DialogHeader className="p-3 sm:p-4 border-b shrink-0 space-y-0">
              <DialogTitle className="text-center text-lg sm:text-2xl font-bold text-primary truncate px-2">
                {selectedTicket?.subject}
              </DialogTitle>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 -ml-2" onClick={() => setSelectedTicket(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-start">
                  <Badge variant={getStatusColor(selectedTicket?.status || "")} className="capitalize text-xs shrink-0">
                    {selectedTicket?.status?.replace('_', ' ')}
                  </Badge>
                  <Select
                    value={selectedTicket?.status}
                    onValueChange={(value) => selectedTicket && updateTicketStatus(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="h-7 text-xs w-auto shrink-0">
                      <span>Change Status</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(selectedTicket?.user_name || selectedTicket?.user_email) && (
                  <span className="text-xs text-muted-foreground truncate max-w-[35%] text-right">
                    {selectedTicket?.user_name || selectedTicket?.user_email}
                  </span>
                )}
              </div>
            </DialogHeader>
            
            <ScrollArea ref={setScrollViewport} className="flex-1 min-h-0 p-4">
              {loadingMessages ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const stored = msg.attachment_url || '';
                    const viewUrl = msg.attachment_view_url || (stored.startsWith('http') ? stored : '');
                    const nameOrPath = msg.attachment_name || stored;
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(nameOrPath) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(stored);
                    const isPdf = /\.pdf$/i.test(nameOrPath) || /\.pdf(\?|$)/i.test(stored);
                    return (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.is_admin_reply ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_admin_reply 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        {msg.attachment_url && viewUrl && (
                          <div className="mt-2">
                            {isImage ? (
              <img 
                                src={viewUrl} 
                                alt="Attachment" 
                                loading="lazy"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                onLoad={() => scrollToBottom()}
                                style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                className="max-w-full rounded max-h-64 object-contain bg-background pointer-events-auto"
                              />
                            ) : isPdf ? (
                              <div className="space-y-1">
                                <object
                                  data={viewUrl}
                                  type="application/pdf"
                                  className="w-full h-64 rounded border bg-background"
                                  aria-label={msg.attachment_name || 'PDF attachment'}
                                >
                                  <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="underline">
                                    Open PDF
                                  </a>
                                </object>
                                <a 
                                  href={viewUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 text-xs underline ${
                                    msg.is_admin_reply ? 'text-primary-foreground' : 'text-primary'
                                  }`}
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {msg.attachment_name || 'Open PDF'}
                                </a>
                              </div>
                            ) : (
                              <a 
                                href={viewUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 text-sm underline ${
                                  msg.is_admin_reply ? 'text-primary-foreground' : 'text-primary'
                                }`}
                              >
                                <Paperclip className="h-4 w-4" />
                                {msg.attachment_name || 'View attachment'}
                              </a>
                            )}
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${
                          msg.is_admin_reply ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {msg.is_admin_reply ? `You (${staffRole === "admin" ? "Admin" : "Support"})` : 'User'} • {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            
            <div className="p-4 pb-14 border-t shrink-0 bg-background" style={{ paddingBottom: 'max(56px, env(safe-area-inset-bottom))' }}>
              {attachment && (
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                  <Image className="h-4 w-4" />
                  <span className="truncate flex-1">{attachment.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachment(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />
                  <Button variant="outline" size="icon" type="button" asChild>
                    <span><Paperclip className="h-4 w-4" /></span>
                  </Button>
                </label>
                <SavedRepliesPicker onSend={async (text) => { setNewMessage(text); }} />
                <Textarea
                  placeholder="Type your reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
                  rows={2}
                />
                <Button onClick={handleSendMessage} disabled={sending} size="icon" className="h-10 w-10 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminTickets;