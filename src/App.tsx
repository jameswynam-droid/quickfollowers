import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { NotificationProvider } from "@/hooks/useNotifications";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ConfirmEmailChange from "./pages/ConfirmEmailChange";
import SeoDiagnostics from "./pages/SeoDiagnostics";

import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Orders from "./pages/Orders";
import Transactions from "./pages/Transactions";
import Admin from "./pages/Admin";
import AdminTickets from "./pages/AdminTickets";
import Tickets from "./pages/Tickets";
import AddFunds from "./pages/AddFunds";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
      <NotificationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
              <Route path="/seo-diagnostics" element={<SeoDiagnostics />} />

              <Route path="/add-funds" element={<AddFunds />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/failed" element={<PaymentFailed />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/services" element={<Services />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </CurrencyProvider>
  </QueryClientProvider>
);

export default App;
