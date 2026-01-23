import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Important info notifications for Services page
const IMPORTANT_INFO = [
  {
    id: "info-1",
    title: "⚠️ Instagram & TikTok Drops",
    content: "Due to platform changes, Instagram and TikTok services may experience occasional drops. This is normal and expected. We recommend ordering slightly more than your target amount to account for potential drops. All our services are processed as described.",
  },
  {
    id: "info-2", 
    title: "📱 Link Format Requirements",
    content: "Make sure your profile/post is PUBLIC before ordering. For Instagram, use full URLs (https://instagram.com/username). For TikTok, use the full video URL. Private accounts cannot receive any services.",
  },
  {
    id: "info-3",
    title: "⏱️ Processing Times",
    content: "Most orders start within 0-12 hours. During high demand periods, orders may take up to 24-72 hours to complete. Speed varies by service type - instant services start immediately, while gradual/drip-feed services are spread over time for natural growth.",
  },
  {
    id: "info-4",
    title: "💰 Refund Policy",
    content: "Refunds are only available for orders that cannot be completed due to technical issues on our end. Once an order starts processing, it cannot be cancelled. Please double-check your link and quantity before placing an order.",
  },
];

export const FloatingNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(() => {
    return localStorage.getItem("important_info_opened") === "true";
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !hasOpened) {
      setHasOpened(true);
      localStorage.setItem("important_info_opened", "true");
    }
  };

  const shouldShake = !hasOpened;

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
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Important Information</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {IMPORTANT_INFO.map((info) => (
                <div
                  key={info.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <h3 className="font-semibold mb-2">{info.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {info.content}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
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
