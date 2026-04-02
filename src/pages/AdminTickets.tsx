import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
}

interface TicketMessage {
  id: string;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  is_admin_reply: boolean;
  created_at: string;
  sender_id: string;
}

const AdminTickets = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      toast.error("Access denied: Admin only");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    await fetchTickets();
  };

  const fetchTickets = async () => {
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      // Fetch user info for each ticket
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
            user_name: profile?.full_name || null
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
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `admin/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  };

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
      await fetchMessages(selectedTicket.id);
      await fetchTickets();
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
    await fetchMessages(ticket.id);
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
    <div className="min-h-screen flex flex-col">
      <Header />
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Messages Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate pr-8">{selectedTicket?.subject}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTicket?.user_name || selectedTicket?.user_email}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={getStatusColor(selectedTicket?.status || "")} className="capitalize">
                      {selectedTicket?.status?.replace('_', ' ')}
                    </Badge>
                    <Select 
                      value={selectedTicket?.status} 
                      onValueChange={(value) => selectedTicket && updateTicketStatus(selectedTicket.id, value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-auto">
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
                </div>
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
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
                        {msg.attachment_url && (
                          <div className="mt-2">
                            {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={msg.attachment_url} 
                                  alt="Attachment" 
                                  className="max-w-full rounded max-h-48 object-contain"
                                />
                              </a>
                            ) : (
                              <a 
                                href={msg.attachment_url} 
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
                          {msg.is_admin_reply ? 'You (Admin)' : 'User'} • {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            <div className="p-4 border-t shrink-0">
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
                <Textarea
                  placeholder="Type your reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                />
                <Button onClick={handleSendMessage} disabled={sending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

export default AdminTickets;