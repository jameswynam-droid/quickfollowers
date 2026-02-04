import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

// Default static info items
const DEFAULT_INFO = [
  {
    id: "default-drops",
    title: "⚠️ Instagram & TikTok Drops",
    summary: "Learn about platform drops and how to grow safely",
    content: `## About Drops on Instagram and TikTok

**What you may notice**

You may see followers, likes, or views reduce after a purchase. Instagram and TikTok use strong detection systems. They monitor how fast an account grows. If an account stays stable for a long time then gets a sharp increase, the system flags it as paid activity. The platform removes part of the growth. This action comes from the platform, not from us.

**Why it happens**

Sharp spikes are the most common trigger. The platform compares past activity with new activity. When the change is too fast, the system reacts. There are other factors that cause drops. Platform updates, new detection rules, user activity levels, and changes in the algorithm can also lead to removals.

**How you can grow safely**

Buy in smaller steps. Keep your growth steady. Slow and consistent growth reduces the risk of removal. Large instant boosts increase the risk.

**What we invest**

We also spend to fund every promotion you receive. When the platform removes results, the funds used for that promotion are lost. We carry that cost with you. We do not remove your results.

**What we ask from you**

Give us patience. Understand that these drops come from the platform system, not from us. We stay committed to supporting you, fixing what we can, and helping you grow in a safer way.

Thank you for trusting us.`,
  },
  {
    id: "default-links",
    title: "📱 Link Format Requirements",
    summary: "Make sure your profile/post is PUBLIC before ordering",
    content: `Make sure your profile/post is **PUBLIC** before ordering.

- **Instagram**: Use full URLs (https://instagram.com/username)
- **TikTok**: Use the full video URL

Private accounts cannot receive any services.`,
  },
  {
    id: "default-processing",
    title: "⏱️ Processing Times",
    summary: "Learn about order processing and delivery times",
    content: `Most orders start within **0-12 hours**. During high demand periods, orders may take up to 24-72 hours to complete.

Speed varies by service type:
- **Instant services**: Start immediately
- **Gradual/drip-feed services**: Spread over time for natural growth`,
  },
  {
    id: "default-refund",
    title: "💰 Refund Policy",
    summary: "Understand our refund and cancellation policy",
    content: `Refunds are only available for orders that cannot be completed due to technical issues on our end.

**Once an order starts processing, it cannot be cancelled.**

Please double-check your link and quantity before placing an order.`,
  },
];

interface InfoItem {
  id: string;
  title: string;
  summary: string;
  content: string;
}

export const FloatingNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [hasOpened, setHasOpened] = useState(() => {
    return localStorage.getItem("important_info_opened") === "true";
  });
  const [dbItems, setDbItems] = useState<InfoItem[]>([]);

  // Fetch from database
  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase
        .from("floating_bell_notifications")
        .select("id, title, summary, content")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (data) {
        setDbItems(data);
      }
    };

    fetchItems();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("floating-bell-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floating_bell_notifications" },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Merge db items first, then defaults
  const allInfoItems = useMemo(() => {
    return [...dbItems, ...DEFAULT_INFO];
  }, [dbItems]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !hasOpened) {
      setHasOpened(true);
      localStorage.setItem("important_info_opened", "true");
    }
    if (!isOpen) setActiveInfoId(null);
  };

  const shouldShake = !hasOpened;

  const activeInfo = useMemo(() => {
    if (!activeInfoId) return null;
    return allInfoItems.find((i) => i.id === activeInfoId) ?? null;
  }, [activeInfoId, allInfoItems]);

  return (
    <>
      <button
        onClick={() => handleOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all",
          shouldShake && "animate-[shake_0.5s_ease-in-out_infinite]"
        )}
        aria-label="Important Information"
      >
        <Bell className="h-6 w-6" />
        {!hasOpened && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
            !
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-md max-h-[85vh]">
          {!activeInfo ? (
            <>
              <DialogHeader>
                <DialogTitle>Important Information</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[65vh] pr-4">
                <div className="space-y-3">
                  {allInfoItems.map((info) => (
                    <button
                      key={info.id}
                      onClick={() => setActiveInfoId(info.id)}
                      className="w-full rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground">{info.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {info.summary}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveInfoId(null)}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
              <DialogHeader>
                <DialogTitle>{activeInfo.title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[65vh] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{activeInfo.content}</ReactMarkdown>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
          75% { transform: rotate(-5deg); }
        }
      `}</style>
    </>
  );
};
