import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const ABSOLUTE_SESSION_LIFETIME_MS = 86400 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes (was 1 min)

export const useSessionGuard = () => {
  const hasCheckedBrowserRestart = useRef(false);

  useEffect(() => {
    const forceLogout = async () => {
      try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
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

    const checkSession = async (isInitial: boolean) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sessionStart = localStorage.getItem('session_start');
      const rememberMe = localStorage.getItem('remember_me') === 'true';

      // If no session_start recorded, set it now (for existing sessions)
      if (!sessionStart) {
        localStorage.setItem('session_start', Date.now().toString());
        sessionStorage.setItem('tab_alive', 'true');
        return;
      }

      const elapsed = Date.now() - parseInt(sessionStart, 10);

      // Absolute 24-hour session lifetime
      if (elapsed >= ABSOLUTE_SESSION_LIFETIME_MS) {
        await forceLogout();
        return;
      }

      // Browser restart detection — only check ONCE on initial mount
      if (!rememberMe && isInitial && !hasCheckedBrowserRestart.current) {
        hasCheckedBrowserRestart.current = true;
        const tabAlive = sessionStorage.getItem('tab_alive');
        if (!tabAlive) {
          // No tab_alive means browser was restarted
          // Grace period: if session just started (< 60s), don't log out
          if (elapsed > 60000) {
            await forceLogout();
            return;
          }
        }
        sessionStorage.setItem('tab_alive', 'true');
      }
    };

    // Check immediately (initial = true)
    checkSession(true);

    // Then check periodically (initial = false — skip browser restart check)
    const interval = setInterval(() => checkSession(false), CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
};
