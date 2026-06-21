import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";

export const ADMIN_SESSION_KEY = "qf_admin_session";

interface AdminSession {
  user_id: string;
  email: string;
  admin_expires_at: number;
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSession;
    if (!s.admin_expires_at || s.admin_expires_at < Date.now()) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

interface Props {
  children: React.ReactNode;
}

const AdminGuard = ({ children }: Props) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const adminSess = getAdminSession();
      if (!adminSess) {
        navigate("/admin", { replace: true });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== adminSess.user_id) {
        clearAdminSession();
        navigate("/admin", { replace: true });
        return;
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        clearAdminSession();
        navigate("/admin", { replace: true });
        return;
      }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (!ready) return <FullPageLoader message="Verifying admin session..." />;
  return <>{children}</>;
};

export default AdminGuard;
