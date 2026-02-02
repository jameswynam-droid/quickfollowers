import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Edit, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

const typeIcons = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const typeColors = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  success: "bg-green-500/10 text-green-500 border-green-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function AdminNotifications({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("info");
    setExpiresAt("");
    setEditingNotification(null);
  };

  const openDialog = (notification?: Notification) => {
    if (notification) {
      setEditingNotification(notification);
      setTitle(notification.title);
      setMessage(notification.message);
      setType(notification.type);
      setExpiresAt(notification.expires_at ? new Date(notification.expires_at).toISOString().slice(0, 16) : "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setSaving(true);
    try {
      const notificationData = {
        title: title.trim(),
        message: message.trim(),
        type,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: userId,
      };

      if (editingNotification) {
        const { error } = await supabase
          .from("notifications")
          .update(notificationData)
          .eq("id", editingNotification.id);

        if (error) throw error;
        toast.success("Notification updated");
      } else {
        const { error } = await supabase
          .from("notifications")
          .insert(notificationData);

        if (error) throw error;
        toast.success("Notification created");
      }

      setDialogOpen(false);
      resetForm();
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.message || "Failed to save notification");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (notification: Notification) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_active: !notification.is_active })
        .eq("id", notification.id);

      if (error) throw error;
      toast.success(`Notification ${notification.is_active ? "disabled" : "enabled"}`);
      fetchNotifications();
    } catch (error: any) {
      toast.error("Failed to update notification");
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Notification deleted");
      fetchNotifications();
    } catch (error: any) {
      toast.error("Failed to delete notification");
    }
  };

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Service Notifications
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage notifications shown on the Services page
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingNotification ? "Edit Notification" : "New Notification"}
                </DialogTitle>
                <DialogDescription>
                  This notification will be displayed on the Services page
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Service Maintenance"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter notification message..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expires">Expires At (Optional)</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? "Saving..." : editingNotification ? "Update" : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {loading ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No notifications</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Type</TableHead>
                  <TableHead className="text-xs sm:text-sm">Title</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Expires</TableHead>
                  <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <Badge className={typeColors[notification.type as keyof typeof typeColors] || typeColors.info}>
                        {typeIcons[notification.type as keyof typeof typeIcons] || typeIcons.info}
                        <span className="ml-1 hidden sm:inline">{notification.type}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm font-medium max-w-[150px] truncate">
                      {notification.title}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Switch
                        checked={notification.is_active}
                        onCheckedChange={() => toggleActive(notification)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                      {notification.expires_at
                        ? new Date(notification.expires_at).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openDialog(notification)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
