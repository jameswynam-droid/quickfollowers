import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { useNoIndex } from "@/hooks/useNoIndex";
import { AdminNotifications } from "@/components/AdminNotifications";
import { AdminBellNotifications } from "@/components/AdminBellNotifications";
import { AdminFloatingBellNotifications } from "@/components/AdminFloatingBellNotifications";
import { AdminDailyPopups } from "@/components/AdminDailyPopups";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminGuard, { clearAdminSession, getAdminSession } from "@/components/admin/AdminGuard";
import UserLookup from "@/components/admin/UserLookup";
import BlogAdmin from "@/components/admin/BlogAdmin";
import SavedRepliesAdmin from "@/components/admin/SavedRepliesAdmin";
import AdminTotpEnroll from "@/components/admin/AdminTotpEnroll";
import StaffManager from "@/components/admin/StaffManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

const AdminPanelInner = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"admin" | "support">("support");
  const [mustEnroll, setMustEnroll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const sess = getAdminSession();
    if (sess) {
      setRole(sess.role || "support");
      setMustEnroll(!!sess.must_enroll_totp);
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    clearAdminSession();
    await supabase.auth.signOut();
    navigate("/admin", { replace: true });
  };

  if (loading) return <FullPageLoader message="Loading panel..." />;

  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{isAdmin ? "Admin Panel" : "Support Panel"}</h1>
            <p className="text-xs text-muted-foreground">{user?.email} · {role}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/tickets")} variant="outline" size="sm">Tickets</Button>
            <Button onClick={handleLogout} size="sm" variant="ghost">Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {mustEnroll && (
          <Alert className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Two-factor authentication required</AlertTitle>
            <AlertDescription>
              Please set up 2FA below before accessing the rest of the panel. Scan the QR with Google Authenticator or Authy, enter the 6-digit code, and log in again.
            </AlertDescription>
          </Alert>
        )}

        {mustEnroll ? (
          <AdminTotpEnroll />
        ) : (
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="users">User Lookup</TabsTrigger>
              <TabsTrigger value="replies">Saved Replies</TabsTrigger>
              <TabsTrigger value="security">2FA</TabsTrigger>
              {isAdmin && <TabsTrigger value="staff">Staff</TabsTrigger>}
              {isAdmin && <TabsTrigger value="blog">Blog / Help</TabsTrigger>}
              {isAdmin && <TabsTrigger value="notifications">Service Alerts</TabsTrigger>}
              {isAdmin && <TabsTrigger value="bell">Header Bell</TabsTrigger>}
              {isAdmin && <TabsTrigger value="floating">Info Bell</TabsTrigger>}
              {isAdmin && <TabsTrigger value="popups">Pop-ups</TabsTrigger>}
            </TabsList>

            <TabsContent value="users"><UserLookup isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="replies"><SavedRepliesAdmin /></TabsContent>
            <TabsContent value="security"><AdminTotpEnroll /></TabsContent>
            {isAdmin && <TabsContent value="staff"><StaffManager currentUserId={user?.id} /></TabsContent>}
            {isAdmin && <TabsContent value="blog"><BlogAdmin /></TabsContent>}
            {isAdmin && <TabsContent value="notifications"><AdminNotifications userId={user?.id} /></TabsContent>}
            {isAdmin && <TabsContent value="bell"><AdminBellNotifications /></TabsContent>}
            {isAdmin && <TabsContent value="floating"><AdminFloatingBellNotifications /></TabsContent>}
            {isAdmin && <TabsContent value="popups"><AdminDailyPopups /></TabsContent>}
          </Tabs>
        )}
      </main>
    </div>
  );
};

const AdminPanel = () => (
  <AdminGuard>
    <AdminPanelInner />
  </AdminGuard>
);

export default AdminPanel;
