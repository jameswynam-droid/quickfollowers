import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ABSOLUTE_SESSION_LIFETIME_MS = 86400 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

export const useSessionGuard = () => {
  useEffect(() => {
    const forceLogout = async () => {
      try { await supabase.auth.signOut({ scope: "global" }); } catch {}
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key === "session_start" || key === "remember_me")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
      window.location.replace("/");
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const sessionStart = localStorage.getItem("session_start");
      if (!sessionStart) {
        localStorage.setItem("session_start", Date.now().toString());
        return;
      }

      const elapsed = Date.now() - parseInt(sessionStart, 10);
      if (elapsed >= ABSOLUTE_SESSION_LIFETIME_MS) {
        await forceLogout();
      }
    };

    checkSession();
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
};
