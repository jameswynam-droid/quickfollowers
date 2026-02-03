import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Bell, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BellNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export function AdminBellNotifications() {
  const [notifications, setNotifications] = useState<BellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("bell_notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bell notifications:", error);
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("bell_notifications").insert({
      title: title.trim(),
      message: message.trim(),
      type,
      created_by: user?.id,
    });

    if (error) {
      toast.error("Failed to create notification");
      console.error(error);
    } else {
      toast.success("Notification created successfully");
      setTitle("");
      setMessage("");
      setType("info");
      fetchNotifications();
    }
    setCreating(false);
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from("bell_notifications")
      .update({ is_active: !currentState })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update notification");
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_active: !currentState } : n))
      );
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("bell_notifications").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete notification");
    } else {
      toast.success("Notification deleted");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/20 text-green-400";
      case "warning":
        return "bg-amber-500/20 text-amber-400";
      default:
        return "bg-blue-500/20 text-blue-400";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Create Bell Notification
          </CardTitle>
          <CardDescription>
            Add notifications that appear in the header notification bell for all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bell-title">Title</Label>
            <Input
              id="bell-title"
              placeholder="e.g., New Feature Available 🎉"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bell-message">Message (can be long)</Label>
            <Textarea
              id="bell-message"
              placeholder="Write your full notification message here. This can be as long as needed..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {creating ? "Creating..." : "Create Bell Notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Bell Notifications</CardTitle>
          <CardDescription>
            Manage notifications shown in the header bell
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No bell notifications yet</p>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${
                      notification.is_active
                        ? "bg-card border-border"
                        : "bg-muted/50 border-muted opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor(
                              notification.type
                            )}`}
                          >
                            {notification.type}
                          </span>
                          {!notification.is_active && (
                            <span className="text-xs text-muted-foreground">Inactive</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {notification.message.length > 200
                            ? `${notification.message.slice(0, 200)}...`
                            : notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={notification.is_active}
                          onCheckedChange={() =>
                            toggleActive(notification.id, notification.is_active)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
