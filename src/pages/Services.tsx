import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { organizeServices, OrganizedService, ServiceCategory } from "@/utils/serviceOrganizer";

const Services = () => {
  const [user, setUser] = useState<any>(null);
  const [organizedCategories, setOrganizedCategories] = useState<ServiceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<OrganizedService | null>(null);
  const [orderLink, setOrderLink] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      const organized = organizeServices(data || []);
      setOrganizedCategories(organized);
    } catch (error: any) {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCategories = () => {
    let filtered = organizedCategories;

    if (selectedPlatform !== "all") {
      filtered = filtered.filter(cat => cat.platform === selectedPlatform);
    }

    if (searchQuery) {
      filtered = filtered.map(category => ({
        ...category,
        subcategories: category.subcategories.map(sub => ({
          ...sub,
          services: sub.services.filter(service =>
            service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.platform.toLowerCase().includes(searchQuery.toLowerCase())
          )
        })).filter(sub => sub.services.length > 0)
      })).filter(cat => cat.subcategories.length > 0);
    }

    return filtered;
  };

  const handleOrderClick = (service: OrganizedService) => {
    setSelectedService(service);
    setOrderDialogOpen(true);
    setOrderLink("");
    setOrderQuantity("");
  };

  const handlePlaceOrder = async () => {
    if (!selectedService || !orderLink || !orderQuantity) {
      toast.error("Please fill all fields");
      return;
    }

    const quantity = parseInt(orderQuantity);
    if (quantity < selectedService.min_order || quantity > selectedService.max_order) {
      toast.error(`Quantity must be between ${selectedService.min_order} and ${selectedService.max_order}`);
      return;
    }

    const totalCost = (selectedService.markedUpRate * quantity).toFixed(2);

    try {
      const { data, error } = await supabase.functions.invoke("place-order", {
        body: {
          service_id: selectedService.id,
          link: orderLink,
          quantity,
        },
      });

      if (error) throw error;

      toast.success(`Order placed! Total cost: ₦${totalCost}`);
      setOrderDialogOpen(false);
      setOrderLink("");
      setOrderQuantity("");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const filteredCategories = getFilteredCategories();
  const platforms = organizedCategories.map(cat => cat.platform);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">SMM Services</h1>
          <p className="text-muted-foreground">Professional social media marketing services organized by platform</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <Input
            placeholder="Search services, platforms, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="md:flex-1"
          />
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-4 py-2 rounded-md border bg-background md:w-64"
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No services found matching your criteria</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {filteredCategories.map((category) => (
              <AccordionItem
                key={category.platform}
                value={category.platform}
                className="border rounded-lg overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">{category.platform}</h2>
                    <span className="text-sm text-muted-foreground">
                      ({category.subcategories.reduce((acc, sub) => acc + sub.services.length, 0)} services)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <Accordion type="multiple" className="space-y-2">
                    {category.subcategories.map((subcategory) => (
                      <AccordionItem
                        key={`${category.platform}-${subcategory.name}`}
                        value={subcategory.name}
                        className="border-l-4 border-primary/20 pl-4"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{subcategory.name}</h3>
                            <span className="text-xs text-muted-foreground">
                              ({subcategory.services.length})
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {subcategory.services.map((service) => (
                              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm leading-tight line-clamp-2">
                                    {service.name.replace(/[🎉✨⚡️🔥💎🌟]/g, '').trim()}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Price per 1000:</span>
                                      <span className="font-semibold text-primary">{service.pricePerThousand}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Min order:</span>
                                      <span>{service.min_order.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Max order:</span>
                                      <span>{service.max_order.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => handleOrderClick(service)}
                                    className="w-full"
                                    size="sm"
                                  >
                                    Order Now
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>
      <Footer />

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Order</DialogTitle>
            <DialogDescription>{selectedService?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link">Link (URL)</Label>
              <Input
                id="link"
                value={orderLink}
                onChange={(e) => setOrderLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                placeholder={`Min: ${selectedService?.min_order}, Max: ${selectedService?.max_order}`}
                min={selectedService?.min_order}
                max={selectedService?.max_order}
              />
            </div>
            {orderQuantity && selectedService && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate per 1000:</span>
                  <span className="font-medium">{selectedService.pricePerThousand}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Cost:</span>
                  <span className="text-primary">₦{(selectedService.markedUpRate * parseInt(orderQuantity || "0")).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button onClick={handlePlaceOrder} className="w-full">
              Confirm Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;