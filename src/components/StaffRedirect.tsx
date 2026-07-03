import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";

/**
 * Wraps end-user pages (dashboard, services, orders, etc).
 * If the current auth user is staff (admin OR support), redirect them
 * to the appropriate admin surface so they cannot access user features.
 */
const StaffRedirect = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setReady(true); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roleList = (roles || []).map((r: any) => r.role);
      if (roleList.includes("admin")) {
        navigate("/admin/panel", { replace: true });
        return;
      }
      if (roleList.includes("support")) {
        navigate("/admin/tickets", { replace: true });
        return;
      }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (!ready) return <FullPageLoader message="Loading..." />;
  return <>{children}</>;
};

export default StaffRedirect;
