import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { organizeServices, OrganizedService, ServiceCategory } from "@/utils/serviceOrganizer";
import { useNoIndex } from "@/hooks/useNoIndex";

const Services = () => {
  useNoIndex(); // Prevent search engine indexing
  const [user, setUser] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizedCategories, setOrganizedCategories] = useState<ServiceCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<OrganizedService | null>(null);
  const [orderLink, setOrderLink] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const fetchUserBalance = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();
    
    if (profile) {
      setUserBalance(profile.balance);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchUserBalance(session.user.id);
      
      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!roles);
    };
    
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const storedSyncTime = localStorage.getItem('lastSyncTime');
    if (storedSyncTime) {
      setLastSyncTime(new Date(storedSyncTime));
    }
    fetchServices();
  }, []);

  const syncAndFetchServices = async (isManual = false) => {
    if (isManual) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    
    try {
      if (isManual) toast.info("Syncing latest services...");
      const { error } = await supabase.functions.invoke("sync-services");
      if (error) throw error;
      
      const syncTime = new Date();
      setLastSyncTime(syncTime);
      localStorage.setItem('lastSyncTime', syncTime.toISOString());
      
      toast.success("Services synced successfully!");
      await fetchServices();
    } catch (e) {
      console.error("Sync failed:", e);
      toast.error("Failed to sync services");
      if (!isManual) {
        await fetchServices();
      }
    } finally {
      if (isManual) {
        setSyncing(false);
      } else {
        setLoading(false);
      }
    }
  };
  
  const handleManualSync = () => {
    syncAndFetchServices(true);
  };

  const fetchServices = async () => {
    const pageSize = 1000;
    let page = 0;
    let all: any[] = [];

    try {
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .order("name", { ascending: true })
          .range(from, to);

        if (error) throw error;

        const batch = data || [];
        all = all.concat(batch);
        console.log(`Fetched batch ${page + 1}:`, batch.length, `Total so far:`, all.length);

        if (batch.length < pageSize) break;
        page++;
      }

      console.log("Total raw services fetched:", all.length);
      const organized = organizeServices(all);
      console.log("Organized categories:", organized.length);
      setOrganizedCategories(organized);
    } catch (error: any) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCategories = () => {
    let filtered = organizedCategories;

    if (selectedPlatform !== "all") {
      filtered = filtered.filter(cat => 
        cat.category.toLowerCase().includes(selectedPlatform.toLowerCase())
      );
    }

    if (searchQuery) {
      filtered = filtered.map(category => ({
        ...category,
        services: category.services.filter(service =>
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.services.length > 0);
    }

    return filtered;
  };

  const handleOrderClick = (service: OrganizedService) => {
    setSelectedService(service);
    setOrderDialogOpen(true);
    setOrderLink("");
    setOrderQuantity("");
  };

  // Parse backend errors into user-friendly messages
  const getFriendlyErrorMessage = (error: string): string => {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('insufficient balance')) {
      return "Insufficient funds. Please add funds to your account.";
    }
    
    if (lowerError.includes('not authenticated') || lowerError.includes('session')) {
      return "Your session has expired. Please sign in again.";
    }
    
    if (lowerError.includes('service not found')) {
      return "This service is no longer available. Please try a different one.";
    }
    
    if (lowerError.includes('profile not found')) {
      return "We couldn't find your account. Please try signing out and back in.";
    }
    
    if (lowerError.includes('missing required fields') || lowerError.includes('invalid')) {
      return "Please check that all fields are filled in correctly.";
    }
    
    if (lowerError.includes('link')) {
      return "Please enter a valid link for this service.";
    }
    
    if (lowerError.includes('quantity') || lowerError.includes('min') || lowerError.includes('max')) {
      return "The quantity you entered is outside the allowed range.";
    }
    
    if (lowerError.includes('provider') || lowerError.includes('key not configured')) {
      return "This service is temporarily unavailable. Please try again later.";
    }
    
    // Generic fallback - don't expose technical details
    return "Something went wrong while placing your order. Please try again.";
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

    const totalCost = ((quantity / 1000) * selectedService.markedUpRate).toFixed(2);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      if (!session?.access_token) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("place-order", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          service_id: selectedService.id,
          link: orderLink,
          quantity,
        },
      });

      if (error) {
        const rawMessage = error.message || (error as any).error || "";
        toast.error(getFriendlyErrorMessage(rawMessage));
        return;
      }

      if (data?.error) {
        toast.error(getFriendlyErrorMessage(data.error));
        return;
      }

      toast.success(`Order placed! Total cost: ₦${totalCost}`);
      
      // Refresh user balance
      if (user?.id) {
        fetchUserBalance(user.id);
      }
      
      setOrderDialogOpen(false);
      setOrderLink("");
      setOrderQuantity("");
      navigate("/dashboard");
    } catch (error: any) {
      const rawMessage = error?.message || error?.error || "";
      toast.error(getFriendlyErrorMessage(rawMessage));
    }
  };

  if (loading) {
    return <FullPageLoader message="Loading services..." />;
  }

  const filteredCategories = getFilteredCategories();
  const platformKeywords = ['Instagram', 'TikTok', 'Twitter', 'YouTube', 'Facebook', 'Telegram', 'Spotify', 'Audiomack', 'Boomplay', 'SoundCloud', 'Discord', 'WhatsApp', 'Snapchat', 'LinkedIn', 'Threads'];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">SMM Services</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Professional social media marketing services</p>
            </div>
            {isAdmin && (
              <div className="flex flex-col sm:items-end gap-2">
                <Button 
                  onClick={handleManualSync} 
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                {lastSyncTime && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {lastSyncTime.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:flex-1"
          />
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm sm:w-64"
          >
            <option value="all">All Categories</option>
            {platformKeywords.map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-muted-foreground text-lg mb-2">No services found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredCategories.map((category) => (
              <Collapsible 
                key={category.category} 
                open={openCategories.has(category.category)}
                onOpenChange={() => toggleCategory(category.category)}
                className="rounded-xl overflow-hidden border bg-card shadow-sm"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b hover:from-primary/15 hover:to-primary/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <ChevronDown 
                          className={`h-4 w-4 sm:h-5 sm:w-5 text-primary transition-transform duration-200 ${
                            openCategories.has(category.category) ? 'rotate-180' : ''
                          }`} 
                        />
                        <h2 className="text-sm sm:text-lg font-semibold text-card-foreground text-left">{category.category}</h2>
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{category.services.length} services</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {category.services.map((service) => (
                        <Card key={service.id} className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300">
                          <CardHeader className="p-3 sm:pb-3 space-y-2">
                            <CardTitle className="text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                              {service.name.replace(/[🎉✨⚡️🔥💎🌟]/g, '').trim()}
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                              Order range: {service.min_order.toLocaleString()} - {service.max_order.toLocaleString()}
                            </CardDescription>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                {service.pricePerThousand}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-2 sm:space-y-3">
                            <div className="space-y-1.5 sm:space-y-2 text-xs">
                              <div className="flex justify-between items-center p-1.5 sm:p-2 rounded-md bg-muted/50">
                                <span className="text-muted-foreground">Min:</span>
                                <span className="font-medium">{service.min_order.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 sm:p-2 rounded-md bg-muted/50">
                                <span className="text-muted-foreground">Max:</span>
                                <span className="font-medium">{service.max_order.toLocaleString()}</span>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleOrderClick(service)}
                              className="w-full text-xs sm:text-sm"
                              size="sm"
                            >
                              Order Now
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </main>
      <Footer />

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Place Order</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{selectedService?.name}</DialogDescription>
          </DialogHeader>
          
          {/* Show user's current balance */}
          <div className="p-3 bg-muted/50 border border-border rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Your Balance:</span>
              <span className="font-bold text-primary">₦{userBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          {/* Show instructional description if available */}
          {selectedService?.description && (
            <div className="p-3 bg-muted/50 border border-border rounded-lg text-xs sm:text-sm whitespace-pre-line">
              {selectedService.description}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="link" className="text-sm">Link (URL)</Label>
              <Input
                id="link"
                value={orderLink}
                onChange={(e) => setOrderLink(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="quantity" className="text-sm">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                placeholder={`Min: ${selectedService?.min_order}, Max: ${selectedService?.max_order}`}
                min={selectedService?.min_order}
                max={selectedService?.max_order}
                className="text-sm"
              />
            </div>
            {orderQuantity && selectedService && (
              <div className="p-3 sm:p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Rate per 1000:</span>
                  <span className="font-medium">{selectedService.pricePerThousand}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-lg font-bold">
                  <span>Total Cost:</span>
                  <span className="text-primary">₦{((parseInt(orderQuantity || "0") / 1000) * selectedService.markedUpRate).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
