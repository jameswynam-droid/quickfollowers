import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { NotificationProvider } from "@/hooks/useNotifications";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ConfirmEmailChange from "./pages/ConfirmEmailChange";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import PlatformLanding from "./pages/PlatformLanding";
import Help from "./pages/Help";
import HelpPost from "./pages/HelpPost";

import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import Transactions from "./pages/Transactions";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import AdminTickets from "./pages/AdminTickets";
import Tickets from "./pages/Tickets";
import AddFunds from "./pages/AddFunds";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import StaffRedirect from "./components/StaffRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SessionGuard = ({ children }: { children: React.ReactNode }) => {
  useSessionGuard();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
      <NotificationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SessionGuard>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/buy/:platform" element={<PlatformLanding />} />
                <Route path="/help" element={<Help />} />
                <Route path="/help/:slug" element={<HelpPost />} />

                <Route path="/add-funds" element={<StaffRedirect><AddFunds /></StaffRedirect>} />
                <Route path="/payment/success" element={<StaffRedirect><PaymentSuccess /></StaffRedirect>} />
                <Route path="/payment/failed" element={<StaffRedirect><PaymentFailed /></StaffRedirect>} />

                <Route path="/dashboard" element={<StaffRedirect><Dashboard /></StaffRedirect>} />
                <Route path="/services" element={<StaffRedirect><Services /></StaffRedirect>} />
                <Route path="/orders" element={<StaffRedirect><Orders /></StaffRedirect>} />
                <Route path="/transactions" element={<StaffRedirect><Transactions /></StaffRedirect>} />
                <Route path="/tickets" element={<StaffRedirect><Tickets /></StaffRedirect>} />
                <Route path="/account" element={<StaffRedirect><Account /></StaffRedirect>} />
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/panel" element={<AdminPanel />} />
                <Route path="/admin/tickets" element={<AdminTickets />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SessionGuard>
        </TooltipProvider>
      </NotificationProvider>
    </CurrencyProvider>
  </QueryClientProvider>
);

export default App;
