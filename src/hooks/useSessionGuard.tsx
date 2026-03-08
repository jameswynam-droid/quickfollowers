import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ABSOLUTE_SESSION_LIFETIME_MS = 86400 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

export const useSessionGuard = () => {
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sessionStart = localStorage.getItem('session_start');
      const rememberMe = localStorage.getItem('remember_me') === 'true';

      // If no session_start recorded, set it now (for existing sessions)
      if (!sessionStart) {
        localStorage.setItem('session_start', Date.now().toString());
        return;
      }

      const elapsed = Date.now() - parseInt(sessionStart, 10);

      // Absolute 24-hour session lifetime
      if (elapsed >= ABSOLUTE_SESSION_LIFETIME_MS) {
        await forceLogout();
        return;
      }

      // If "Remember me" was not checked, clear session on tab/browser reopen
      // We detect this by checking sessionStorage — it clears when browser closes
      if (!rememberMe) {
        const tabAlive = sessionStorage.getItem('tab_alive');
        if (!tabAlive) {
          // First load of this browser session — mark as alive
          // If session_start exists but tab_alive doesn't, browser was restarted
          const timeSinceStart = Date.now() - parseInt(sessionStart, 10);
          if (timeSinceStart > 30000) {
            // Browser was likely restarted (not a fresh login)
            await forceLogout();
            return;
          }
        }
        sessionStorage.setItem('tab_alive', 'true');
      }
    };

    const forceLogout = async () => {
      try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      // Clear all auth data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key === 'session_start' || key === 'remember_me')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
      window.location.replace("/");
    };

    // Check immediately
    checkSession();

    // Then check periodically
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
};
