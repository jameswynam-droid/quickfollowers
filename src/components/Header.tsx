import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useUnreadTickets } from "@/hooks/useUnreadTickets";
import logoImg from "@/assets/logo.png";

interface HeaderProps {
  onAuthClick?: (type: "login" | "signup") => void;
}

const Header = ({ onAuthClick }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { unreadCount } = useUnreadTickets(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearLocalAuthState = () => {
    const clearStorage = (storage: Storage) => {
      Object.keys(storage).forEach((key) => {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          storage.removeItem(key);
        }
      });
    };

    clearStorage(localStorage);
    clearStorage(sessionStorage);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut(); // best effort global
    } catch {
      // ignore, we'll still clear local state below
    } finally {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      clearLocalAuthState();
      setIsAuthenticated(false);
      setUserId(null);
      toast.success("Logged out successfully");
      window.location.replace("/");
    }
  };

  const TicketLink = ({ className, onClick, children }: { className?: string; onClick?: () => void; children?: React.ReactNode }) => (
    <Link
      to="/tickets"
      className={className}
      onClick={onClick}
    >
      {children || "Tickets"}
      {unreadCount > 0 && (
        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold rounded-full bg-yellow-500 text-yellow-950">
          {unreadCount}
        </span>
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 glass-effect shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
            <img 
              src={logoImg} 
              alt="QuickFollowers" 
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              width="40"
              height="40"
            />
          </div>
          <span className="text-lg sm:text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">QuickFollowers</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-foreground/80 hover:text-primary transition">
                Dashboard
              </Link>
              <Link to="/services" className="text-foreground/80 hover:text-primary transition">
                New Order
              </Link>
              <Link to="/orders" className="text-foreground/80 hover:text-primary transition">
                Orders
              </Link>
              <TicketLink className="text-foreground/80 hover:text-primary transition inline-flex items-center" />
              <Link to="/account" className="text-foreground/80 hover:text-primary transition">
                Account
              </Link>
              <a
                href="https://wa.me/+2348071365600?text=Hello%20QuickFollowers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/80 hover:text-primary transition"
              >
                Contact Us on WhatsApp
              </a>
            </>
          ) : (
            <>
              <a href="#services" className="text-foreground/80 hover:text-primary transition">
                Services
              </a>
              <a href="#how" className="text-foreground/80 hover:text-primary transition">
                How it Works
              </a>
              <a href="#faq" className="text-foreground/80 hover:text-primary transition">
                FAQ
              </a>
              <a href="#contact" className="text-foreground/80 hover:text-primary transition">
                Contact
              </a>
            </>
          )}
        </nav>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && (
            <>
              <NotificationBell />
              <ThemeToggle />
            </>
          )}
          {isAuthenticated ? (
            <Button onClick={handleLogout} variant="outline">
              <i className="fa-solid fa-right-from-bracket mr-2"></i>
              Log out
            </Button>
          ) : (
            <>
              <Button onClick={() => onAuthClick?.("login")} variant="ghost">
                Login
              </Button>
              <Button onClick={() => onAuthClick?.("signup")} variant="premium" className="shadow-lg">
                Sign Up
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthenticated && (
            <>
              <NotificationBell />
              <ThemeToggle />
            </>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-xl sm:text-2xl text-foreground p-1"
          >
            <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"}`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pb-4 space-y-2 border-t bg-card">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/services"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                New Order
              </Link>
              <Link
                to="/orders"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Orders
              </Link>
              <Link
                to="/transactions"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Transactions
              </Link>
              <TicketLink
                className="block py-2 text-foreground/80 hover:text-primary inline-flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              />
              <Link
                to="/add-funds"
                className="block py-2 text-foreground/80 hover:text-primary font-medium text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                💰 Add Funds
              </Link>
              <Link
                to="/account"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Account
              </Link>
              <a
                href="https://wa.me/+2348071365600?text=Hello%20QuickFollowers"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 text-foreground/80 hover:text-primary"
              >
                Contact Us on WhatsApp
              </a>
              
              {/* Currency Selector in Mobile Menu */}
              <div className="py-3 border-t border-b">
                <p className="text-xs text-muted-foreground mb-2">Currency</p>
                <CurrencySelector variant="compact" />
              </div>
              
              <Button onClick={handleLogout} variant="outline" className="w-full mt-2">
                Log out
              </Button>
            </>
          ) : (
            <>
              <a
                href="#services"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </a>
              <a
                href="#how"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it Works
              </a>
              <a
                href="#faq"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <a
                href="#contact"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => onAuthClick?.("login")} variant="outline" className="w-full">
                  Login
                </Button>
                <Button onClick={() => onAuthClick?.("signup")} className="w-full">
                  Sign Up
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
