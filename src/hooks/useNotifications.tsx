import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "read">) => void;
  hasEverOpened: boolean;
  setHasEverOpened: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Default notifications for new users - Only Welcome and 24/7 Support
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

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem("notifications");
    const hasOpened = localStorage.getItem("notifications_opened") === "true";
    
    setHasEverOpenedState(hasOpened);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        })));
      } catch {
        initializeDefaults();
      }
    } else {
      initializeDefaults();
    }
  }, []);

  const initializeDefaults = () => {
    const defaultNotifs: Notification[] = DEFAULT_NOTIFICATIONS.map((n, i) => ({
      ...n,
      id: `default-${i}`,
      createdAt: new Date(Date.now() - i * 3600000), // Stagger by 1 hour
      read: false,
    }));
    setNotifications(defaultNotifs);
    saveToStorage(defaultNotifs);
  };

  const saveToStorage = (notifs: Notification[]) => {
    localStorage.setItem("notifications", JSON.stringify(notifs));
  };

  const setHasEverOpened = (value: boolean) => {
    setHasEverOpenedState(value);
    localStorage.setItem("notifications_opened", value.toString());
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      saveToStorage(updated);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  };

  const addNotification = (notification: Omit<Notification, "id" | "createdAt" | "read">) => {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      saveToStorage(updated);
      return updated;
    });
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
        addNotification,
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
