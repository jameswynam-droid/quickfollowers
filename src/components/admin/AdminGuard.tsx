import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";

export const ADMIN_SESSION_KEY = "qf_admin_session";

interface AdminSession {
  user_id: string;
  email: string;
  role: "admin" | "support";
  admin_expires_at: number;
  must_enroll_totp?: boolean;
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
  requireRole?: "admin" | "support" | "any";
}

const AdminGuard = ({ children, requireRole = "any" }: Props) => {
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
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roleList = (roles || []).map((r: any) => r.role);
      const isAdmin = roleList.includes("admin");
      const isSupport = roleList.includes("support");
      if (!isAdmin && !isSupport) {
        clearAdminSession();
        navigate("/admin", { replace: true });
        return;
      }
      if (requireRole === "admin" && !isAdmin) {
        navigate("/admin/tickets", { replace: true });
        return;
      }
      if (adminSess.must_enroll_totp) {
        // support must complete TOTP setup before anything else
        if (window.location.pathname !== "/admin/panel") {
          navigate("/admin/panel", { replace: true });
          return;
        }
      }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [navigate, requireRole]);

  if (!ready) return <FullPageLoader message="Verifying session..." />;
  return <>{children}</>;
};

export default AdminGuard;
