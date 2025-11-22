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
    </div>
  );
};

export default Index;
