import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceCard from "@/components/ServiceCard";
import AuthModal from "@/components/AuthModal";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authType, setAuthType] = useState<"login" | "signup">("login");
  const navigate = useNavigate();

  const handleAuthClick = (type: "login" | "signup") => {
    setAuthType(type);
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = (data: any) => {
    console.log("Auth submitted:", data);
    // In a real app, handle authentication here
    setAuthModalOpen(false);
    navigate("/dashboard");
  };

  const services = [
    {
      icon: "fa-brands fa-instagram",
      iconColor: "text-pink-600",
      title: "Instagram Service",
      description: "High-quality real-looking engagement. Instant start, 30-day refill.",
    },
    {
      icon: "fa-brands fa-tiktok",
      iconColor: "text-black",
      title: "TikTok Service",
      description: "Fast worldwide engagement. Lifetime stable, no drop.",
    },
    {
      icon: "fa-brands fa-youtube",
      iconColor: "text-red-600",
      title: "YouTube Service",
      description: "Real engagement from active accounts. Monetization safe.",
    },
    {
      icon: "fa-brands fa-x-twitter",
      iconColor: "text-slate-900",
      title: "X Service",
      description: "Aged accounts interaction. Boost your reach organically.",
    },
    {
      icon: "fa-brands fa-facebook",
      iconColor: "text-blue-600",
      title: "Facebook Service",
      description: "Worldwide page interaction. No drop, refill guaranteed.",
    },
    {
      icon: "fa-brands fa-spotify",
      iconColor: "text-green-600",
      title: "Spotify Service",
      description: "Increase plays & ranking. Premium streams available.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header onAuthClick={handleAuthClick} />

      {/* Hero Section */}
      <section className="gradient-hero text-white">
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Go Viral <span className="text-yellow-300">Faster</span>
            <br />
            for Less Money
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto opacity-90">
            Real followers, likes, views & more for Instagram, TikTok, YouTube, X, Facebook, Spotify.
            Instant start, refill guarantee.
          </p>
          <div className="mt-10">
            <Button size="lg" onClick={() => (window.location.href = "#services")} className="btn-pulse text-lg">
              Browse Services
            </Button>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold">11M+</div>
              <div className="opacity-80 text-sm">Orders Delivered</div>
            </div>
            <div>
              <div className="text-3xl font-bold">0.3s</div>
              <div className="opacity-80 text-sm">Average Start</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="opacity-80 text-sm">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Popular Services</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <ServiceCard
                key={index}
                {...service}
                onOrder={() => handleAuthClick("login")}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">3 Steps to Go Viral</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Account</h3>
              <p className="text-muted-foreground">Sign up and verify your email.</p>
            </div>
            <div>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Add Funds</h3>
              <p className="text-muted-foreground">Deposit via Bank Transfer. We credit instantly.</p>
            </div>
            <div>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Place Order</h3>
              <p className="text-muted-foreground">Use the website dashboard to enter your link and quantity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="bg-card rounded-xl shadow px-6 py-4 open:shadow-lg transition group">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                Are the followers real?
                <i className="fa-solid fa-chevron-down group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-3">
                We deliver a mix of real and high-quality accounts that look authentic. Drops are rare, but we
                offer 30-day refill on eligible services.
              </p>
            </details>
            <details className="bg-card rounded-xl shadow px-6 py-4 open:shadow-lg transition group">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                How long does it take to start?
                <i className="fa-solid fa-chevron-down group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-3">
                Most orders start within 30-60 seconds. Larger campaigns may take up to 12 hours to ramp up
                gradually.
              </p>
            </details>
            <details className="bg-card rounded-xl shadow px-6 py-4 open:shadow-lg transition group">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                What payment methods do you accept?
                <i className="fa-solid fa-chevron-down group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-3">
                Bank Transfer only. We credit instantly once confirmed.
              </p>
            </details>
            <details className="bg-card rounded-xl shadow px-6 py-4 open:shadow-lg transition group">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                Can I resell your services?
                <i className="fa-solid fa-chevron-down group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-3">
                Absolutely. Open a sub-account and set your own prices. We keep no branding on delivered
                engagement.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Boost Your Brand?</h2>
          <p className="text-lg opacity-90 mb-8">Create your account and place orders in minutes.</p>
          <Button size="lg" onClick={() => handleAuthClick("signup")} className="btn-pulse text-lg bg-white text-primary hover:bg-white/90">
            Create Account
          </Button>
        </div>
      </section>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        type={authType}
        onClose={() => setAuthModalOpen(false)}
        onSwitch={() => setAuthType(authType === "login" ? "signup" : "login")}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
};

export default Index;
