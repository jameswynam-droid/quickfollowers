import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { notifyStaff } from "@/lib/staffPush";
import AdminGuard, { getAdminSession } from "@/components/admin/AdminGuard";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";

interface Msg {
  id: string;
  sender_id: string;
  sender_email: string;
  subject: string;
  body: string;
  status: string;
  reply: string | null;
  replied_at: string | null;
  read_by_admin: boolean;
  read_by_sender: boolean;
  created_at: string;
}

const StaffMessagesInner = () => {
  useNoIndex();
  const navigate = useNavigate();
  const sess = getAdminSession();
  const isAdmin = sess?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("internal_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Could not load messages. Please refresh.");
    } else {
      setMessages((data || []) as Msg[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("internal-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and a message before sending.");
      return;
    }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      toast.error("Your session expired. Please log in again.");
      return;
    }
    const { error } = await supabase.from("internal_messages").insert({
      sender_id: user.id,
      sender_email: user.email || "",
      subject: subject.trim(),
      body: body.trim(),
      status: "open",
    });
    setSending(false);
    if (error) {
      toast.error("Message could not be sent. Please try again.");
      return;
    }
    setSubject("");
    setBody("");
    await notifyStaff("internal");
    toast.success("Message sent to the admin team");
    load();
  };

  const sendReply = async (m: Msg) => {
    const text = (replyDrafts[m.id] || "").trim();
    if (!text) {
      toast.error("Write a reply first.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("internal_messages")
      .update({
        reply: text,
        replied_by: user?.id ?? null,
        replied_at: new Date().toISOString(),
        status: "resolved",
        read_by_admin: true,
        read_by_sender: false,
      })
      .eq("id", m.id);
    if (error) {
      toast.error("Reply could not be saved. Please try again.");
      return;
    }
    setReplyDrafts((d) => ({ ...d, [m.id]: "" }));
    toast.success("Reply sent");
    load();
  };

  const markRead = async (m: Msg) => {
    await supabase.from("internal_messages").update({ read_by_admin: true }).eq("id", m.id);
    load();
  };

  if (loading) return <FullPageLoader message="Loading messages..." />;

  const openCount = messages.filter((m) => m.status === "open").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Staff Messages</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Requests from support staff" : "Message the admin team"}
              {openCount > 0 && ` · ${openCount} open`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/tickets")}>Tickets</Button>
            <Button size="sm" variant="ghost" onClick={() => navigate("/admin/panel")}>Panel</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New message to admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Balance top up request for user@example.com"
                maxLength={120}
              />
            </div>
            <div>
              <Label>Details</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Include the username or email, the amount, and the reason."
                maxLength={4000}
              />
            </div>
            <Button onClick={send} disabled={sending} variant="premium">
              {sending ? "Sending..." : "Send to admin"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
          {messages.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{m.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.sender_email} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={m.status === "open" ? "destructive" : "secondary"}>
                    {m.status === "open" ? "Open" : "Resolved"}
                  </Badge>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{m.body}</p>

                {m.reply && (
                  <div className="rounded-md border bg-muted/50 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">
                      Admin reply {m.replied_at ? `· ${new Date(m.replied_at).toLocaleString()}` : ""}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{m.reply}</p>
                  </div>
                )}

                {isAdmin && !m.reply && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      rows={3}
                      value={replyDrafts[m.id] || ""}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                      placeholder="Reply to this request"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => sendReply(m)}>Send reply</Button>
                      {!m.read_by_admin && (
                        <Button size="sm" variant="outline" onClick={() => markRead(m)}>Mark read</Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

const StaffMessages = () => (
  <AdminGuard>
    <StaffMessagesInner />
  </AdminGuard>
);

export default StaffMessages;
