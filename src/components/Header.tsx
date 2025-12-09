import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HeaderProps {
  onAuthClick?: (type: "login" | "signup") => void;
}

const Header = ({ onAuthClick }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check current auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-effect shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-bolt text-white text-xl"></i>
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">QuickFollowers</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
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
              <a
                href="https://wa.me/+2349112484106"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/80 hover:text-primary transition"
              >
                Contact Us
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
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-2xl text-foreground"
        >
          <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"}`}></i>
        </button>
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
              <a
                href="https://wa.me/+2349112484106"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 text-foreground/80 hover:text-primary"
              >
                Contact Us
              </a>
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
