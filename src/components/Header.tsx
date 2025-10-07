import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  isAuthenticated?: boolean;
  onAuthClick?: (type: "login" | "signup") => void;
}

const Header = ({ isAuthenticated = false, onAuthClick }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // In a real app, clear session/token
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-lg shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <i className="fa-solid fa-bolt text-primary text-2xl"></i>
          <span className="text-2xl font-bold text-foreground">QuickFollowers</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {isAuthenticated ? (
            <>
              <a href="#services" className="text-foreground/80 hover:text-primary transition">
                New Order
              </a>
              <a href="#orders" className="text-foreground/80 hover:text-primary transition">
                Orders
              </a>
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
            <Button onClick={handleLogout} variant="outline" className="btn-pulse">
              Log out
            </Button>
          ) : (
            <>
              <Button onClick={() => onAuthClick?.("login")} variant="outline" className="btn-pulse">
                Login
              </Button>
              <Button onClick={() => onAuthClick?.("signup")} className="btn-pulse">
                Sign Up
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
              <a
                href="#services"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                New Order
              </a>
              <a
                href="#orders"
                className="block py-2 text-foreground/80 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Orders
              </a>
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
