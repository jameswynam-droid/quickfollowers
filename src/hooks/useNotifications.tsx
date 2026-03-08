import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  createdAt: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  hasUnread: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  hasEverOpened: boolean;
  setHasEverOpened: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const DEFAULT_NOTIFICATIONS: Omit<Notification, "id" | "createdAt" | "read">[] = [
  {
    title: "Welcome to QuickFollowers! 🎉",
    message: "Welcome to QuickFollowers! We're excited to have you here. Start growing your social media presence today by adding funds to your wallet and placing your first order. Browse our wide range of services including Instagram, TikTok, YouTube, Twitter, and many more platforms. All orders are processed quickly and safely. Thank you for choosing QuickFollowers!",
    type: "success",
  },
  {
    title: "24/7 Customer Support 💬",
    message: "Our dedicated support team is available around the clock to assist you with any questions or issues. You can reach us through our ticket system for detailed inquiries, or contact us directly on WhatsApp for quick responses. We typically respond within minutes! Your satisfaction is our top priority, and we're here to help you succeed on social media.",
    type: "info",
  },
];

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasEverOpened, setHasEverOpenedState] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const readIdsRef = useRef<Set<string>>(new Set());

  // Load read state once
  useEffect(() => {
    const hasOpened = localStorage.getItem("notifications_opened") === "true";
    setHasEverOpenedState(hasOpened);

    const savedReadIds = localStorage.getItem("notifications_read");
    if (savedReadIds) {
      try {
        const parsed = new Set<string>(JSON.parse(savedReadIds));
        setReadIds(parsed);
        readIdsRef.current = parsed;
      } catch {
        // Ignore
      }
    }
  }, []);

  // Fetch bell notifications ONCE (no readIds dependency to avoid re-subscription loops)
  useEffect(() => {
    const fetchBellNotifications = async () => {
      const { data: dbNotifications } = await supabase
        .from("bell_notifications")
        .select("id, title, message, type, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const currentReadIds = readIdsRef.current;

      const dbNotifs: Notification[] = (dbNotifications || []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as "info" | "success" | "warning",
        createdAt: new Date(n.created_at),
        read: currentReadIds.has(n.id),
      }));

      const defaultNotifs: Notification[] = DEFAULT_NOTIFICATIONS.map((n, i) => ({
        ...n,
        id: `default-${i}`,
        createdAt: new Date(Date.now() - (i + 100) * 3600000),
        read: currentReadIds.has(`default-${i}`),
      }));

      const merged = [...dbNotifs, ...defaultNotifs];
      merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNotifications(merged);
    };

    fetchBellNotifications();

    const channel = supabase
      .channel("bell-notifications-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bell_notifications" },
        () => fetchBellNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // No readIds dependency - prevents re-subscription loop

  const setHasEverOpened = (value: boolean) => {
    setHasEverOpenedState(value);
    localStorage.setItem("notifications_opened", value.toString());
  };

  const saveReadIds = (ids: Set<string>) => {
    localStorage.setItem("notifications_read", JSON.stringify([...ids]));
  };

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const updated = new Set(prev).add(id);
      readIdsRef.current = updated;
      saveReadIds(updated);
      return updated;
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      notifications.forEach((n) => updated.add(n.id));
      readIdsRef.current = updated;
      saveReadIds(updated);
      return updated;
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        hasUnread,
        markAsRead,
        markAllAsRead,
        hasEverOpened,
        setHasEverOpened,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
