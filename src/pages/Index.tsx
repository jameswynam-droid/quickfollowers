import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import DailyPopupModal from "@/components/DailyPopupModal";


const Index = () => {
  const navigate = useNavigate();
  // Theme is now handled globally by ThemeProvider with localStorage persistence
  const services = [
    {
      icon: "fa-brands fa-instagram",
      iconColor: "text-pink-500",
      title: "Instagram Services",
      description: "757+ services available. Starting from ₦1.45 per 1000",
    },
    {
      icon: "fa-brands fa-tiktok",
      iconColor: "text-foreground",
      title: "TikTok Services",
      description: "1244+ services available. Starting from ₦1.12 per 1000",
    },
    {
      icon: "fa-brands fa-youtube",
      iconColor: "text-red-500",
      title: "YouTube Services",
      description: "2282+ services available. Starting from ₦69.67 per 1000",
    },
    {
      icon: "fa-brands fa-x-twitter",
      iconColor: "text-foreground",
      title: "Twitter Services",
      description: "706+ services available. Starting from ₦1.38 per 1000",
    },
    {
      icon: "fa-brands fa-facebook",
      iconColor: "text-blue-500",
      title: "Facebook Services",
      description: "663+ services available. Starting from ₦1.45 per 1000",
    },
    {
      icon: "fa-brands fa-spotify",
      iconColor: "text-green-500",
      title: "Spotify Services",
      description: "1578+ services available. Starting from ₦153.28 per 1000",
    },
  ];

  useEffect(() => {
    // Redirect authenticated users to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);



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
          <div className="absolute top-1/4 -left-20 w-48 sm:w-96 h-48 sm:h-96 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/4 -right-20 w-48 sm:w-96 h-48 sm:h-96 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-32 text-center">
          <div className="inline-block mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm font-semibold border border-white/20">
            🌍 #1 SMM Panel in the World • Trusted by 500K+ Creators
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black leading-tight mb-4 sm:mb-6">
            Grow Your Social Media
            <br />
            <span className="bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-200 bg-clip-text text-transparent">
              10x Faster
            </span>
          </h1>
          
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl max-w-3xl mx-auto text-white/90 leading-relaxed font-medium px-4">
            Premium SMM Panel • Real Engagement • Instant Delivery
            <br />
            Instagram • TikTok • YouTube • X • Facebook • Spotify
          </p>
          
          <div className="mt-8 sm:mt-12 flex justify-center">
            <Button 
              size="lg" 
              onClick={() => (window.location.href = "#services")} 
              className="btn-pulse text-sm sm:text-lg shadow-2xl bg-white text-primary hover:bg-white/90 hover:scale-105"
              variant="secondary"
            >
              <i className="fa-solid fa-rocket mr-2"></i>
              Browse Services
            </Button>
          </div>
          
          {/* Stats */}
          <div className="mt-12 sm:mt-20 grid grid-cols-3 gap-2 sm:gap-3 md:gap-8 max-w-3xl mx-auto px-2">
            <div className="stat-card p-2 sm:p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black mb-0.5 sm:mb-1 md:mb-2">11M+</div>
              <div className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Orders Delivered</div>
            </div>
            <div className="stat-card p-2 sm:p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black mb-0.5 sm:mb-1 md:mb-2">&lt;1min</div>
              <div className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Avg. Start Time</div>
            </div>
            <div className="stat-card p-2 sm:p-3 md:p-6 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl border border-white/20">
              <div className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black mb-0.5 sm:mb-1 md:mb-2">24/7</div>
              <div className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Live Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-12 sm:py-24 bg-muted/30 dark:bg-muted/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-block mb-3 sm:mb-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 dark:bg-primary/20 rounded-full text-xs sm:text-sm font-semibold text-primary">
              Premium Services
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-foreground">Choose Your Platform</h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-4">
              High-quality engagement delivered instantly. All services come with a 30-day refill guarantee.
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
      <section id="how" className="py-12 sm:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-foreground">How It Works</h2>
            <p className="text-muted-foreground text-sm sm:text-lg">Start growing in minutes with our simple process</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-8">
            <div className="relative p-4 sm:p-8 bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border dark:border-border/80 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-3 sm:-top-4 left-4 sm:left-8 w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl gradient-primary flex items-center justify-center text-white text-sm sm:text-xl font-black shadow-lg">
                1
              </div>
              <div className="mt-4 sm:mt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <i className="fa-solid fa-user-plus text-primary text-lg sm:text-2xl"></i>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-3 text-center text-foreground">Create Account</h3>
                <p className="text-muted-foreground text-center leading-relaxed text-xs sm:text-base">Quick registration with email verification. Get started in under 60 seconds.</p>
              </div>
            </div>
            <div className="relative p-4 sm:p-8 bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border dark:border-border/80 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-3 sm:-top-4 left-4 sm:left-8 w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl gradient-primary flex items-center justify-center text-white text-sm sm:text-xl font-black shadow-lg">
                2
              </div>
              <div className="mt-4 sm:mt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-success/10 dark:bg-success/20 flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <i className="fa-solid fa-wallet text-success text-lg sm:text-2xl"></i>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-3 text-center text-foreground">Add Funds</h3>
                <p className="text-muted-foreground text-center leading-relaxed text-xs sm:text-base">Secure bank transfer deposit. Funds credited instantly to your account.</p>
              </div>
            </div>
            <div className="relative p-4 sm:p-8 bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-border dark:border-border/80 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-3 sm:-top-4 left-4 sm:left-8 w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl gradient-primary flex items-center justify-center text-white text-sm sm:text-xl font-black shadow-lg">
                3
              </div>
              <div className="mt-4 sm:mt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-secondary/10 dark:bg-secondary/20 flex items-center justify-center mb-3 sm:mb-4 mx-auto">
                  <i className="fa-solid fa-rocket text-secondary text-lg sm:text-2xl"></i>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-3 text-center text-foreground">Place Order</h3>
                <p className="text-muted-foreground text-center leading-relaxed text-xs sm:text-base">Choose service, paste link, and watch your growth skyrocket instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12 sm:py-24 bg-muted/30 dark:bg-muted/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-block mb-3 sm:mb-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 dark:bg-primary/20 rounded-full text-xs sm:text-sm font-semibold text-primary">
              FAQ
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-foreground">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-sm sm:text-lg">Everything you need to know about our services</p>
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
                What payment methods do you accept?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                We accept card payments, bank transfers, and mobile money worldwide via Flutterwave and Paystack. Local
                Nigerian (NGN) payments are also fully supported, and your balance is credited instantly after a
                successful payment.
              </p>
            </details>
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                Do you offer refunds?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                Yes. If an order fails, is cancelled, or only partially delivered, your account is automatically
                refunded the unused portion of your balance, no need to open a ticket.
              </p>
            </details>
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                Is my account safe?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                Absolutely. We never ask for your password, we only need the public link to your post or profile to
                deliver engagement safely. Sessions are encrypted end-to-end.
              </p>
            </details>
            <details className="group bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg px-4 sm:px-8 py-4 sm:py-6 open:shadow-xl transition-all border border-border dark:border-border/80 hover:border-primary/50">
              <summary className="font-bold text-sm sm:text-lg cursor-pointer list-none flex items-center justify-between text-foreground">
                Which platforms do you support?
                <i className="fa-solid fa-chevron-down text-primary group-open:rotate-180 transition-transform text-xs sm:text-base"></i>
              </summary>
              <p className="text-muted-foreground mt-3 sm:mt-4 leading-relaxed text-xs sm:text-base">
                Instagram, TikTok, YouTube, X (Twitter), Facebook, Spotify, Telegram, Snapchat, Threads, SoundCloud,
                Twitch and many more, followers, likes, views, subscribers, plays and shares for all of them.
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
      <section className="relative py-12 sm:py-24 gradient-hero text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-white/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm font-semibold border border-white/20">
            Join 500,000+ Content Creators
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-4 sm:mb-6">Ready to Go Viral?</h2>
          <p className="text-sm sm:text-xl text-white/90 mb-6 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
            Create your account now and get instant access to premium social media growth services.
          </p>
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={() => handleAuthClick("signup")} 
              className="btn-pulse text-sm sm:text-lg shadow-2xl bg-white text-primary hover:bg-white/90 hover:scale-105"
            >
              <i className="fa-solid fa-user-plus mr-2"></i>
              Create Free Account
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <DailyPopupModal />
    </div>
  );
};

export default Index;
