import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, Edit2, X, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FloatingBellNotification {
  id: string;
  title: string;
  summary: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export function AdminFloatingBellNotifications() {
  const [notifications, setNotifications] = useState<FloatingBellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("floating-bell-notifications-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floating_bell_notifications" },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("floating_bell_notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load floating bell notifications");
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setContent("");
    setIsActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (notification: FloatingBellNotification) => {
    setTitle(notification.title);
    setSummary(notification.summary);
    setContent(notification.content);
    setIsActive(notification.is_active);
    setEditingId(notification.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !summary.trim() || !content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("floating_bell_notifications")
        .update({ title, summary, content, is_active: isActive })
        .eq("id", editingId);

      if (error) {
        toast.error("Failed to update notification");
      } else {
        toast.success("Notification updated");
        resetForm();
      }
    } else {
      const { error } = await supabase.from("floating_bell_notifications").insert({
        title,
        summary,
        content,
        is_active: isActive,
        created_by: user.id,
      });

      if (error) {
        toast.error("Failed to create notification");
      } else {
        toast.success("Notification created");
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("floating_bell_notifications").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete notification");
    } else {
      toast.success("Notification deleted");
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from("floating_bell_notifications")
      .update({ is_active: !currentState })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update notification");
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Floating Bell Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Manage long-form notifications shown in the floating bell on the New Order page. Supports full markdown.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Notification
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit Notification" : "New Notification"}
            </CardTitle>
            <CardDescription>
              Use markdown for formatting: **bold**, *italic*, ## headings, - lists, [links](url)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., ⚠️ Important Update"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary (shown in list)</Label>
              <Input
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief description shown before opening"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content (Markdown)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Full notification content with markdown..."
                rows={10}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="is-active">Active</Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                <Check className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No floating bell notifications yet.
            </p>
          ) : (
            notifications.map((notification) => (
              <Card key={notification.id} className={!notification.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">{notification.title}</h4>
                        {!notification.is_active && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {notification.summary}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={notification.is_active}
                        onCheckedChange={() => toggleActive(notification.id, notification.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(notification)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(notification.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
