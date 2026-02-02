import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
}

const typeIcons = {
  info: <Info className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
};

const typeVariants: Record<string, "default" | "destructive"> = {
  info: "default",
  warning: "default",
  success: "default",
  error: "destructive",
};

const typeStyles: Record<string, string> = {
  info: "border-blue-500/50 bg-blue-500/10 text-blue-400 [&>svg]:text-blue-400",
  warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 [&>svg]:text-yellow-400",
  success: "border-green-500/50 bg-green-500/10 text-green-400 [&>svg]:text-green-400",
  error: "border-red-500/50 bg-red-500/10 text-red-400 [&>svg]:text-red-400",
};

export function ServiceNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotifications();

    // Set up realtime subscription
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type")
      .eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false });

    if (data) {
      setNotifications(data);
    }
  };

  const dismissNotification = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visibleNotifications = notifications.filter((n) => !dismissed.has(n.id));

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleNotifications.map((notification) => (
        <Alert
          key={notification.id}
          variant={typeVariants[notification.type] || "default"}
          className={`relative ${typeStyles[notification.type] || typeStyles.info}`}
        >
          {typeIcons[notification.type as keyof typeof typeIcons] || typeIcons.info}
          <AlertTitle className="pr-8 font-semibold">{notification.title}</AlertTitle>
          <AlertDescription className="text-sm opacity-90">
            {notification.message}
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-60 hover:opacity-100"
            onClick={() => dismissNotification(notification.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
