import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TicketsSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Plus, MessageSquare, Paperclip, Send, X, Image } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
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

const Tickets = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [newTicketAttachment, setNewTicketAttachment] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
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
      await fetchTickets(session.user.id);
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    }
  };

  const fetchTickets = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
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
    const filePath = `${user.id}/${fileName}`;

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

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }

    setCreating(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          subject: newTicketSubject.trim(),
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload attachment if exists
      let attachmentUrl = null;
      let attachmentName = null;
      if (newTicketAttachment) {
        attachmentUrl = await uploadAttachment(newTicketAttachment);
        attachmentName = newTicketAttachment.name;
      }

      // Create first message
      const { error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          message: newTicketMessage.trim(),
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          is_admin_reply: false,
        });

      if (messageError) throw messageError;

      toast.success("Ticket created successfully");
      setShowNewTicket(false);
      setNewTicketSubject("");
      setNewTicketMessage("");
      setNewTicketAttachment(null);
      await fetchTickets(user.id);
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast.error(error.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
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
          is_admin_reply: false,
        });

      if (error) throw error;

      setNewMessage("");
      setAttachment(null);
      await fetchMessages(selectedTicket.id);
      await markTicketAsRead(selectedTicket.id);
      await fetchTickets(user.id);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const markTicketAsRead = async (ticketId: string) => {
    if (!user) return;
    try {
      await supabase
        .from("ticket_reads")
        .upsert(
          { user_id: user.id, ticket_id: ticketId, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,ticket_id" }
        );
    } catch (error) {
      console.error("Error marking ticket as read:", error);
    }
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await fetchMessages(ticket.id);
    await markTicketAsRead(ticket.id);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8"><TicketsSkeleton /></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Get help with your orders</p>
          </div>
          <Button onClick={() => setShowNewTicket(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No tickets yet</p>
              <Button onClick={() => setShowNewTicket(true)}>Create Your First Ticket</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
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

        {/* New Ticket Dialog */}
        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Attachment (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setNewTicketAttachment(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {newTicketAttachment && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setNewTicketAttachment(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {newTicketAttachment && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {newTicketAttachment.name}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTicket} disabled={creating}>
                {creating ? "Creating..." : "Create Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ticket Messages Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate pr-8">{selectedTicket?.subject}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStatusColor(selectedTicket?.status || "")} className="capitalize">
                      {selectedTicket?.status?.replace('_', ' ')}
                    </Badge>
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
                      className={`flex ${msg.is_admin_reply ? 'justify-start' : 'justify-end'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_admin_reply 
                            ? 'bg-muted' 
                            : 'bg-primary text-primary-foreground'
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
                                  msg.is_admin_reply ? 'text-primary' : 'text-primary-foreground'
                                }`}
                              >
                                <Paperclip className="h-4 w-4" />
                                {msg.attachment_name || 'View attachment'}
                              </a>
                            )}
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${
                          msg.is_admin_reply ? 'text-muted-foreground' : 'text-primary-foreground/70'
                        }`}>
                          {msg.is_admin_reply ? 'Support' : 'You'} • {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {selectedTicket?.status !== 'closed' && (
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
                <div className="flex gap-2">
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
                    placeholder="Type your message..."
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
            )}
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

export default Tickets;