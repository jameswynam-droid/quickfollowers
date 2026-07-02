import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNoIndex } from "@/hooks/useNoIndex";
import { AdminNotifications } from "@/components/AdminNotifications";
import { AdminBellNotifications } from "@/components/AdminBellNotifications";
import { AdminFloatingBellNotifications } from "@/components/AdminFloatingBellNotifications";
import { AdminDailyPopups } from "@/components/AdminDailyPopups";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminGuard, { clearAdminSession } from "@/components/admin/AdminGuard";
import UserLookup from "@/components/admin/UserLookup";
import BlogAdmin from "@/components/admin/BlogAdmin";
import SavedRepliesAdmin from "@/components/admin/SavedRepliesAdmin";
import AdminTotpEnroll from "@/components/admin/AdminTotpEnroll";

const AdminPanelInner = () => {
  useNoIndex();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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

  if (loading) return <FullPageLoader message="Loading admin panel..." />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/tickets")} variant="outline" size="sm">Tickets</Button>
            <Button onClick={handleLogout} size="sm" variant="ghost">Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="users">User Lookup</TabsTrigger>
            <TabsTrigger value="replies">Saved Replies</TabsTrigger>
            <TabsTrigger value="blog">Blog / Help</TabsTrigger>
            <TabsTrigger value="security">2FA</TabsTrigger>
            <TabsTrigger value="notifications">Service Alerts</TabsTrigger>
            <TabsTrigger value="bell">Header Bell</TabsTrigger>
            <TabsTrigger value="floating">Info Bell</TabsTrigger>
            <TabsTrigger value="popups">Pop-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="users"><UserLookup /></TabsContent>
          <TabsContent value="replies"><SavedRepliesAdmin /></TabsContent>
          <TabsContent value="blog"><BlogAdmin /></TabsContent>
          <TabsContent value="security"><AdminTotpEnroll /></TabsContent>
          <TabsContent value="notifications"><AdminNotifications userId={user?.id} /></TabsContent>
          <TabsContent value="bell"><AdminBellNotifications /></TabsContent>
          <TabsContent value="floating"><AdminFloatingBellNotifications /></TabsContent>
          <TabsContent value="popups"><AdminDailyPopups /></TabsContent>
        </Tabs>
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
