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
  // Theme is now handled globally by ThemeProvider with localStorage persistence
  const [services, setServices] = useState([
    {
      icon: "fa-brands fa-instagram",
      iconColor: "text-pink-500",
      title: "Instagram Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-tiktok",
      iconColor: "text-foreground",
      title: "TikTok Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-youtube",
      iconColor: "text-red-500",
      title: "YouTube Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-x-twitter",
      iconColor: "text-foreground",
      title: "X Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-facebook",
      iconColor: "text-blue-500",
      title: "Facebook Services",
      description: "Loading...",
      price: "₦0",
    },
    {
      icon: "fa-brands fa-spotify",
      iconColor: "text-green-500",
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
          instagram: { icon: "fa-brands fa-instagram", color: "text-pink-500", keyword: "Instagram" },
          tiktok: { icon: "fa-brands fa-tiktok", color: "text-foreground", keyword: "TikTok" },
          youtube: { icon: "fa-brands fa-youtube", color: "text-red-500", keyword: "YouTube" },
          twitter: { icon: "fa-brands fa-x-twitter", color: "text-foreground", keyword: "Twitter" },
          facebook: { icon: "fa-brands fa-facebook", color: "text-blue-500", keyword: "Facebook" },
          spotify: { icon: "fa-brands fa-spotify", color: "text-green-500", keyword: "Spotify" },
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
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] -left-16 w-40 sm:w-72 h-40 sm:h-72 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[20%] -right-12 w-52 sm:w-80 h-52 sm:h-80 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-28 md:py-32">
          <div className="max-w-3xl">
            <p className="mb-4 sm:mb-5 text-xs sm:text-sm font-medium text-white/70 tracking-wide uppercase">
              Trusted by 500K+ creators worldwide
            </p>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-5 sm:mb-7 tracking-tight">
              Grow your audience.
              <br />
              <span className="text-yellow-300">
                Not your workload.
              </span>
            </h1>
            
            <p className="text-sm sm:text-lg md:text-xl max-w-xl text-white/80 leading-relaxed mb-8 sm:mb-10">
              Premium social media growth across Instagram, TikTok, YouTube, X, Facebook & Spotify — delivered in minutes, not days.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button 
                size="lg" 
                onClick={() => handleAuthClick("signup")} 
                className="text-sm sm:text-base shadow-xl bg-white text-primary hover:bg-white/90 font-bold px-6 sm:px-8"
                variant="secondary"
              >
                Get Started Free
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </Button>
              <Button 
                size="lg" 
                onClick={() => (window.location.href = "#services")} 
                className="text-sm sm:text-base bg-white/10 text-white hover:bg-white/20 border border-white/20 font-medium"
                variant="ghost"
              >
                View Services
              </Button>
            </div>
          </div>
          
          {/* Stats — asymmetric strip */}
          <div className="mt-14 sm:mt-20 flex flex-wrap gap-6 sm:gap-10 md:gap-14">
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold">11M+</div>
              <div className="text-white/60 text-xs sm:text-sm mt-0.5">Orders delivered</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold">&lt;1 min</div>
              <div className="text-white/60 text-xs sm:text-sm mt-0.5">Avg. start time</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold">24/7</div>
              <div className="text-white/60 text-xs sm:text-sm mt-0.5">Live support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-14 sm:py-24 bg-muted/30 dark:bg-muted/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-10 sm:mb-16 max-w-xl">
            <p className="text-xs sm:text-sm font-medium text-primary tracking-wide uppercase mb-2">Premium services</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-2 sm:mb-3">Pick your platform</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              High-quality engagement with a 30-day refill guarantee on eligible services.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
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
      <section id="how" className="py-14 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-10 sm:mb-16">
            <p className="text-xs sm:text-sm font-medium text-primary tracking-wide uppercase mb-2">Simple process</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">Three steps to growth</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { num: "01", icon: "fa-solid fa-user-plus", title: "Create Account", desc: "Quick registration with email verification. Get started in under 60 seconds." },
              { num: "02", icon: "fa-solid fa-wallet", title: "Add Funds", desc: "Secure payment via Paystack, Flutterwave, or bank transfer. Credited instantly." },
              { num: "03", icon: "fa-solid fa-paper-plane", title: "Place Order", desc: "Choose a service, paste your link, and watch the results roll in." },
            ].map((step) => (
              <div key={step.num} className="p-5 sm:p-7 bg-card rounded-xl sm:rounded-2xl border border-border hover:border-primary/40 transition-colors duration-300">
                <span className="text-xs font-bold text-primary/50 tracking-widest">{step.num}</span>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center my-3 sm:my-4">
                  <i className={`${step.icon} text-primary text-base sm:text-lg`}></i>
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-14 sm:py-24 bg-muted/30 dark:bg-muted/10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="mb-10 sm:mb-14">
            <p className="text-xs sm:text-sm font-medium text-primary tracking-wide uppercase mb-2">FAQ</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">Common questions</h2>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                Are the followers real?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                We deliver a mix of real and high-quality accounts that look authentic. Drops are rare, but we
                offer 30-day refill on eligible services.
              </p>
            </details>
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                How long does it take to start?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                Most orders start within 30-60 seconds. Larger campaigns may take up to 12 hours to ramp up
                gradually.
              </p>
            </details>
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                Can I resell your services?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                Absolutely. Open a sub-account and set your own prices. We keep no branding on delivered
                engagement.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-14 sm:py-24 gradient-hero text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 right-0 w-60 sm:w-96 h-60 sm:h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-5 tracking-tight">Ready to start growing?</h2>
          <p className="text-sm sm:text-lg text-white/75 mb-7 sm:mb-10 max-w-lg leading-relaxed">
            Create your free account and get access to premium social media services — no contracts, cancel anytime.
          </p>
          <Button 
            size="lg" 
            onClick={() => handleAuthClick("signup")} 
            className="text-sm sm:text-base shadow-xl bg-white text-primary hover:bg-white/90 font-bold px-6 sm:px-8"
          >
            Create Free Account
            <i className="fa-solid fa-arrow-right ml-2"></i>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
