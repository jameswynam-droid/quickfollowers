import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { PLATFORM_LANDINGS } from "@/data/platformLandingData";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";

const SITE = "https://quickfollowers.online";

const PlatformLanding = () => {
  const { platform } = useParams<{ platform: string }>();
  const data = platform ? PLATFORM_LANDINGS[platform] : undefined;

  useEffect(() => {
    if (!data) return;
    document.title = data.metaTitle;
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let tag = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    setMeta("description", data.metaDescription);
    setMeta("keywords", data.keywords.join(", "));
    setMeta("og:title", data.metaTitle, "property");
    setMeta("og:description", data.metaDescription, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:url", `${SITE}/buy/${data.slug}`, "property");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", data.metaTitle);
    setMeta("twitter:description", data.metaDescription);

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE}/buy/${data.slug}`;

    // JSON-LD: Service + FAQ
    const jsonId = "platform-jsonld";
    let script = document.getElementById(jsonId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = jsonId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `${data.platform} SMM Panel Services`,
        provider: { "@type": "Organization", name: "QuickFollowers", url: SITE },
        areaServed: "Worldwide",
        description: data.metaDescription,
        url: `${SITE}/buy/${data.slug}`,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: data.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ]);

    return () => {
      const s = document.getElementById(jsonId);
      if (s) s.remove();
    };
  }, [data]);

  if (!data) return <Navigate to="/404" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section
          className="py-16 md:py-24 px-4"
          style={{ background: `linear-gradient(135deg, ${data.brandColor}15, transparent)` }}
        >
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Buy {data.platform} Followers, Likes & Views — Cheapest Panel
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 mb-8 max-w-3xl mx-auto">
              {data.tagline}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Start ordering <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" variant="outline">See all services</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Services list */}
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
              Available {data.platform} services
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {data.services.map((s) => (
                <div key={s} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-12 md:py-16 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
              Why pick QuickFollowers for {data.platform}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {data.benefits.map((b, i) => {
                const Icon = [Zap, Shield, TrendingUp][i % 3];
                return (
                  <Card key={b.title}>
                    <CardHeader>
                      <Icon className="h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-lg">{b.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/80 text-sm">{b.body}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 md:py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
              {data.platform} FAQ
            </h2>
            <div className="space-y-4">
              {data.faqs.map((f) => (
                <Card key={f.q}>
                  <CardHeader>
                    <CardTitle className="text-base">{f.q}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/80 text-sm">{f.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 md:py-16 px-4 bg-primary/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Ready to grow on {data.platform}?
            </h2>
            <p className="text-foreground/80 mb-6">
              Sign up in seconds, fund your wallet and place your first order.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PlatformLanding;
