import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Zap, Users, Award, Clock, HeadphonesIcon } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              About <span className="text-primary">QuickFollowers</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your trusted partner for social media growth. We help individuals, businesses, and influencers 
              boost their online presence with high-quality engagement services.
            </p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-8">Our Mission</h2>
              <p className="text-lg text-muted-foreground text-center leading-relaxed">
                At QuickFollowers, we believe everyone deserves a chance to grow their social media presence. 
                Our mission is to provide affordable, reliable, and high-quality social media marketing services 
                that help our customers achieve their goals. Whether you're a content creator looking to expand 
                your audience or a business aiming to increase brand visibility, we're here to help you succeed.
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose QuickFollowers?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Fast Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Get your orders started within minutes. Our automated system ensures quick processing 
                    and delivery of all services.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Safe & Secure</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your account safety is our priority. We use secure methods that comply with platform 
                    guidelines to protect your accounts.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Real Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    We provide high-quality engagement from real users to help boost your social proof 
                    and credibility online.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Best Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Competitive pricing without compromising quality. Get more value for your money 
                    with our affordable packages.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">24/7 Availability</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Our platform is available round the clock. Place orders anytime, anywhere, 
                    and track your progress in real-time.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <HeadphonesIcon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Dedicated Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Our customer support team is always ready to assist you with any questions 
                    or concerns you may have.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Services We Offer */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8">Platforms We Support</h2>
            <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-12">
              We offer growth services for all major social media platforms including Instagram, 
              TikTok, YouTube, Facebook, Twitter/X, Telegram, and many more.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Twitter/X', 'Telegram', 'Spotify', 'LinkedIn'].map((platform) => (
                <span 
                  key={platform}
                  className="px-6 py-3 bg-primary/10 text-primary rounded-full font-medium"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-primary/5">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Grow Your Social Media?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers who have boosted their online presence with QuickFollowers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/">View Services</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
