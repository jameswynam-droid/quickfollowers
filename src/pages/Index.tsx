import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  name: string;
  category: string;
  rate: number;
  min_order: number;
  max_order: number;
  description: string | null;
}

const Index = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([
    {
      icon: "fa-brands fa-instagram",
      iconColor: "text-pink-600",
      title: "Instagram Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-tiktok",
      iconColor: "text-black",
      title: "TikTok Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-youtube",
      iconColor: "text-red-600",
      title: "YouTube Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-x-twitter",
      iconColor: "text-slate-900",
      title: "X Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-facebook",
      iconColor: "text-blue-600",
      title: "Facebook Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-spotify",
      iconColor: "text-green-600",
      title: "Spotify Services",
      description: "Loading...",
      price: "₦0",
    },
  ]);

  useEffect(() => {
    // Redirect authenticated users to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("rate", { ascending: true });

      if (error) throw error;

      if (data) {
        const platformMap: { [key: string]: { icon: string; color: string; keyword: string } } = {
          instagram: { icon: "fa-brands fa-instagram", color: "text-pink-600", keyword: "Instagram" },
          tiktok: { icon: "fa-brands fa-tiktok", color: "text-black", keyword: "TikTok" },
          youtube: { icon: "fa-brands fa-youtube", color: "text-red-600", keyword: "YouTube" },
          twitter: { icon: "fa-brands fa-x-twitter", color: "text-slate-900", keyword: "Twitter" },
          facebook: { icon: "fa-brands fa-facebook", color: "text-blue-600", keyword: "Facebook" },
          spotify: { icon: "fa-brands fa-spotify", color: "text-green-600", keyword: "Spotify" },
        };

        const updatedServices = Object.entries(platformMap).map(([platform, config]) => {
          const platformServices = data.filter(
            (s: Service) =>
              s.category.toLowerCase().includes(platform) ||
              s.name.toLowerCase().includes(config.keyword.toLowerCase())
          );

          const cheapestService = platformServices[0];
          const serviceCount = platformServices.length;

          return {
            icon: config.icon,
            iconColor: config.color,
            title: `${config.keyword} Services`,
            description: cheapestService
              ? `${serviceCount}+ services available. Starting from ₦${Number(cheapestService.rate).toFixed(2)} per 1000`
              : "Services coming soon",
            price: cheapestService ? `From ₦${Number(cheapestService.rate).toFixed(2)}` : "N/A",
          };
        });

        setServices(updatedServices);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const handleAuthClick = (type: "login" | "signup") => {
    navigate(`/auth?mode=${type}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onAuthClick={handleAuthClick} />

      {/* Hero Section */}
      <section className="relative gradient-hero text-white overflow-hidden">
        {/* Animated background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-32 text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold border border-white/20">
            🚀 Trusted by 500K+ Content Creators
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            Grow Your Social Media
            <br />
            <span className="bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-200 bg-clip-text text-transparent">
              10x Faster
            </span>
          </h1>
          
          <p className="mt-6 text-lg md:text-xl max-w-3xl mx-auto text-white/90 leading-relaxed font-medium">
            Premium SMM Panel • Real Engagement • Instant Delivery
            <br />
            Instagram • TikTok • YouTube • X • Facebook • Spotify
          </p>
          
          <div className="mt-12 flex justify-center">
            <Button 
              size="lg" 
              onClick={() => (window.location.href = "#services")} 
              className="btn-pulse text-lg shadow-2xl bg-white text-primary hover:bg-white/90 hover:scale-105"
              variant="secondary"
            >
              <i className="fa-solid fa-rocket mr-2"></i>
              Browse Services
            </Button>
          </div>
          
          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-3 md:gap-8 max-w-3xl mx-auto">
            <div className="stat-card p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-2xl md:text-4xl lg:text-5xl font-black mb-1 md:mb-2">11M+</div>
              <div className="text-white/80 text-xs md:text-sm font-medium">Orders Delivered</div>
            </div>
            <div className="stat-card p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-2xl md:text-4xl lg:text-5xl font-black mb-1 md:mb-2">&lt;1min</div>
              <div className="text-white/80 text-xs md:text-sm font-medium">Avg. Start Time</div>
            </div>
            <div className="stat-card p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-2xl md:text-4xl lg:text-5xl font-black mb-1 md:mb-2">24/7</div>
              <div className="text-white/80 text-xs md:text-sm font-medium">Live Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded-full text-sm font-semibold text-primary">
              Premium Services
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">Choose Your Platform</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              High-quality engagement delivered instantly. All services come with a 30-day refill guarantee.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
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
      <section id="how" className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Start growing in minutes with our simple process</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative p-8 bg-gradient-card rounded-2xl border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-4 left-8 w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white text-xl font-black shadow-lg">
                1
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <i className="fa-solid fa-user-plus text-primary text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-center">Create Account</h3>
                <p className="text-muted-foreground text-center leading-relaxed">Quick registration with email verification. Get started in under 60 seconds.</p>
              </div>
            </div>
            <div className="relative p-8 bg-gradient-card rounded-2xl border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-4 left-8 w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white text-xl font-black shadow-lg">
                2
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4 mx-auto">
                  <i className="fa-solid fa-wallet text-success text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-center">Add Funds</h3>
                <p className="text-muted-foreground text-center leading-relaxed">Secure bank transfer deposit. Funds credited instantly to your account.</p>
              </div>
            </div>
            <div className="relative p-8 bg-gradient-card rounded-2xl border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-4 left-8 w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white text-xl font-black shadow-lg">
                3
              </div>
              <div className="mt-6">
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 mx-auto">
                  <i className="fa-solid fa-rocket text-secondary text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-center">Place Order</h3>
                <p className="text-muted-foreground text-center leading-relaxed">Choose service, paste link, and watch your growth skyrocket instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 rounded-full text-sm font-semibold text-primary">
              FAQ
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to know about our services</p>
          </div>
          <div className="space-y-4">
            <details className="group bg-card rounded-2xl shadow-lg px-8 py-6 open:shadow-xl transition-all border border-border/50 hover:border-primary/50">
              <summary className="font-bold text-lg cursor-pointer list-none flex items-center justify-between">
                Are the followers real?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                We deliver a mix of real and high-quality accounts that look authentic. Drops are rare, but we
                offer 30-day refill on eligible services.
              </p>
            </details>
            <details className="group bg-card rounded-2xl shadow-lg px-8 py-6 open:shadow-xl transition-all border border-border/50 hover:border-primary/50">
              <summary className="font-bold text-lg cursor-pointer list-none flex items-center justify-between">
                How long does it take to start?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Most orders start within 30-60 seconds. Larger campaigns may take up to 12 hours to ramp up
                gradually.
              </p>
            </details>
            <details className="group bg-card rounded-2xl shadow-lg px-8 py-6 open:shadow-xl transition-all border border-border/50 hover:border-primary/50">
              <summary className="font-bold text-lg cursor-pointer list-none flex items-center justify-between">
                What payment methods do you accept?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Bank Transfer only. We credit instantly once confirmed.
              </p>
            </details>
            <details className="group bg-card rounded-2xl shadow-lg px-8 py-6 open:shadow-xl transition-all border border-border/50 hover:border-primary/50">
              <summary className="font-bold text-lg cursor-pointer list-none flex items-center justify-between">
                Can I resell your services?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Absolutely. Open a sub-account and set your own prices. We keep no branding on delivered
                engagement.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 gradient-hero text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold border border-white/20">
            Join 500,000+ Content Creators
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6">Ready to Go Viral?</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create your account now and get instant access to premium social media growth services.
          </p>
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={() => handleAuthClick("signup")} 
              className="btn-pulse text-lg shadow-2xl bg-white text-primary hover:bg-white/90 hover:scale-105"
            >
              <i className="fa-solid fa-user-plus mr-2"></i>
              Create Free Account
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
