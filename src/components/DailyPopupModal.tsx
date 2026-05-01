import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface DailyPopup {
  id: string;
  title: string;
  message: string;
  primary_button_label: string | null;
  primary_button_url: string | null;
  primary_button_color: string | null;
  secondary_button_label: string | null;
  secondary_button_url: string | null;
  secondary_button_color: string | null;
}

const todayKey = (id: string) => {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `popup_seen_${id}_${ymd}`;
};

const DailyPopupModal = () => {
  const [popup, setPopup] = useState<DailyPopup | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("daily_popups")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const seen = localStorage.getItem(todayKey(data.id));
      if (!seen) {
        setPopup(data as DailyPopup);
        setOpen(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const close = () => {
    if (popup) localStorage.setItem(todayKey(popup.id), "1");
    setOpen(false);
  };

  const handleButtonClick = (url: string | null) => {
    close();
    if (!url) return;
    if (url.startsWith("/")) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noreferrer,noopener");
    }
  };

  if (!popup) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{popup.title}</DialogTitle>
          <DialogDescription className="text-base text-foreground whitespace-pre-wrap pt-2">
            {popup.message}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {popup.primary_button_label && (
            <Button
              onClick={() => handleButtonClick(popup.primary_button_url)}
              className="flex-1 text-white"
              style={popup.primary_button_color ? { backgroundColor: popup.primary_button_color } : undefined}
            >
              {popup.primary_button_label}
            </Button>
          )}
          {popup.secondary_button_label && (
            <Button
              onClick={() => handleButtonClick(popup.secondary_button_url)}
              variant="outline"
              className="flex-1"
              style={
                popup.secondary_button_color
                  ? { borderColor: popup.secondary_button_color, color: popup.secondary_button_color }
                  : undefined
              }
            >
              {popup.secondary_button_label}
            </Button>
          )}
          {!popup.primary_button_label && !popup.secondary_button_label && (
            <Button onClick={close} className="flex-1">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailyPopupModal;
