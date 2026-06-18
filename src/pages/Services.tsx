import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullPageLoader from "@/components/FullPageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { organizeServices, OrganizedService, ServiceCategory, getDisplayServiceId } from "@/utils/serviceOrganizer";
import { useNoIndex } from "@/hooks/useNoIndex";
import { FloatingNotificationBell } from "@/components/FloatingNotificationBell";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/hooks/useCurrency";
import { ServiceNotifications } from "@/components/ServiceNotifications";
import { FunctionsHttpError } from "@supabase/supabase-js";

const Services = () => {
  useNoIndex();
  const { formatPrice, convertFromNGN } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizedCategories, setOrganizedCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // SMM panel form state
  const [globalSearch, setGlobalSearch] = useState("");
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categorySearch, setCategorySearch] = useState("");
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState("");
  const [selectedService, setSelectedService] = useState<OrganizedService | null>(null);
  const [orderLink, setOrderLink] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [customComments, setCustomComments] = useState("");
  const [dripFeedEnabled, setDripFeedEnabled] = useState(false);
  const [dripFeedRuns, setDripFeedRuns] = useState("");
  const [dripFeedInterval, setDripFeedInterval] = useState("");
  // Auto-service (subscriptions) fields
  const [autoUsername, setAutoUsername] = useState("");
  const [autoMin, setAutoMin] = useState("");
  const [autoMax, setAutoMax] = useState("");
  const [autoPosts, setAutoPosts] = useState("");
  const [autoOldPosts, setAutoOldPosts] = useState("");
  const [autoDelay, setAutoDelay] = useState("");
  const [autoExpiry, setAutoExpiry] = useState("");
  // Website traffic with keywords
  const [trafficKeywords, setTrafficKeywords] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Debounce both searches (300ms) for snappier typing/clearing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalSearch(globalSearch), 300);
    return () => clearTimeout(t);
  }, [globalSearch]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategorySearch(categorySearch), 300);
    return () => clearTimeout(t);
  }, [categorySearch]);

  const isCustomCommentService = (service: OrganizedService | null) => {
    if (!service) return false;
    const nameLower = service.name.toLowerCase();
    const typeLower = (service.type || '').toLowerCase();
    return typeLower.includes('custom comment') || typeLower.includes('custom_comments') ||
      nameLower.includes('custom comment') || (nameLower.includes('comment') && nameLower.includes('custom'));
  };

  const getCommentLineCount = (comments: string) => {
    if (!comments.trim()) return 0;
    return comments.split('\n').filter(line => line.trim()).length;
  };

  const isInstagramService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    return `${service.name} ${service.originalCategory}`.toLowerCase().includes('instagram');
  };

  const isTikTokService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    const txt = `${service.name} ${service.originalCategory}`.toLowerCase();
    return txt.includes('tiktok') || txt.includes('tik tok');
  };

  // Auto-service classifier
  // The provider's `type` may say "subscription" for many services that the user does NOT want
  // treated as subscriptions (auto members, auto followers, "Future Posts" services, "By Post Count" services, etc.)
  // We narrow that down with a precise rule matrix.
  const isTelegramService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    return `${service.name} ${service.originalCategory}`.toLowerCase().includes('telegram');
  };

  const isAutoMembersOrFollowers = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    const blob = `${service.name} ${service.originalCategory}`.toLowerCase();
    return /auto\s*(members?|followers?|subscribers?)/.test(blob);
  };

  const isAutoService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    const typeLower = (service.type || '').toLowerCase();
    if (!typeLower.includes('subscription')) return false;
    // Auto members / followers / subscribers never need subscription boxes
    if (isAutoMembersOrFollowers(service)) return false;
    const blob = `${service.name} ${service.originalCategory}`.toLowerCase();
    const provider = (service as any).provider || '';
    const sid = (service.id || '').toString().split('-')[1] || service.id;

    // Service-specific overrides
    if (sid === '7287') return false;            // standard
    if (sid === '7289' || sid === '6599' || sid === '7773') return true; // subscription

    if (isTelegramService(service)) {
      if (provider === 'owlet') {
        // Only "Reaction" or AI-comments services get subscription boxes
        return blob.includes('reaction') || blob.includes('ai-generated') || blob.includes('ai generated');
      }
      // SmmFollows Telegram auto
      if (blob.includes('future post')) return false;
      if (blob.includes('by post count')) return false;
      // Generic auto views/reactions on SmmFollows → subscription
      return blob.includes('auto');
    }
    // TikTok / Instagram / others with subscription type
    return true;
  };

  // Show Old posts for any auto-service except TikTok and service 7287/specific exclusions.
  // Service 7289 forces both new + old posts.
  const hasOldPostsField = (service: OrganizedService | null): boolean => {
    if (!isAutoService(service)) return false;
    const sid = (service?.id || '').toString().split('-')[1] || service?.id;
    if (sid === '7289') return true;
    if (isTikTokService(service)) return false;
    return true;
  };
  const isInstagramAutoService = (service: OrganizedService | null): boolean => hasOldPostsField(service);

  // Fixed-quantity package (e.g. Instagram Verified BlueTick Comments id 4379, per-1/per-2/etc):
  // min === max and not a custom-comment service. Hide quantity, auto-send quantity = min_order.
  const isFixedQuantityService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    if (isCustomCommentService(service)) return false;
    if (isAutoService(service)) return false;
    return service.min_order === service.max_order && service.min_order >= 1;
  };

  const isHashtagService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    const blob = `${service.name} ${service.originalCategory} ${service.description || ''} ${service.type || ''}`.toLowerCase();
    return blob.includes('hashtag') || (blob.includes('traffic') && service.type?.toLowerCase().includes('mentions hashtag'));
  };
  const isTrafficKeywordsService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    const blob = `${service.name} ${service.originalCategory} ${service.description || ''} ${service.type || ''}`.toLowerCase();
    return /traffic/.test(blob) && /(keyword|seo)/.test(blob) && !isHashtagService(service);
  };
  const isBrandSearchesService = (service: OrganizedService | null): boolean => {
    if (!service) return false;
    return service.originalCategory.toLowerCase().includes('brand searches');
  };
  const needsTrafficExtraField = (service: OrganizedService | null): boolean =>
    isHashtagService(service) || isTrafficKeywordsService(service) || isBrandSearchesService(service);


  const todayIso = () => new Date().toISOString().slice(0, 10);

  const delayOptions = [0, 5, 10, 15, 20, 30, 40, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600];

  const fetchUserBalance = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();
    if (profile) setUserBalance(profile.balance);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      fetchUserBalance(session.user.id);
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
    if (storedSyncTime) setLastSyncTime(new Date(storedSyncTime));
    fetchServices();
  }, []);

  const SERVICES_CACHE_KEY = 'services_cache';
  const SERVICES_CACHE_EXPIRY_KEY = 'services_cache_expiry';
  const SERVICES_CACHE_DURATION = 60 * 60 * 1000;

  const fetchServices = async () => {
    try {
      const cached = sessionStorage.getItem(SERVICES_CACHE_KEY);
      const expiry = sessionStorage.getItem(SERVICES_CACHE_EXPIRY_KEY);
      if (cached && expiry && Date.now() < parseInt(expiry)) {
        const organized = organizeServices(JSON.parse(cached));
        setOrganizedCategories(organized);
        setLoading(false);
        return;
      }
    } catch {}

    const pageSize = 1000;
    let page = 0;
    let all: any[] = [];

    try {
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("services")
          .select("id, name, category, rate, min_order, max_order, type, dripfeed, average_time, description")
          .order("name", { ascending: true })
          .range(from, to);
        if (error) throw error;
        const batch = data || [];
        all = all.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }
      try {
        sessionStorage.setItem(SERVICES_CACHE_KEY, JSON.stringify(all));
        sessionStorage.setItem(SERVICES_CACHE_EXPIRY_KEY, (Date.now() + SERVICES_CACHE_DURATION).toString());
      } catch {}
      const organized = organizeServices(all);
      setOrganizedCategories(organized);
    } catch (error: any) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const syncAndFetchServices = async () => {
    setSyncing(true);
    try {
      toast.info("Syncing latest services...");
      try { sessionStorage.removeItem(SERVICES_CACHE_KEY); sessionStorage.removeItem(SERVICES_CACHE_EXPIRY_KEY); } catch {}
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
    } finally {
      setSyncing(false);
    }
  };

  // All unique categories
  const categories = useMemo(() => {
    return organizedCategories.map(c => c.category);
  }, [organizedCategories]);

  // All services flat (for global search)
  const allServices = useMemo(() => {
    return organizedCategories.flatMap(c => c.services);
  }, [organizedCategories]);

  // Global search results — across ALL services by name OR id
  const globalSearchResults = useMemo(() => {
    const q = debouncedGlobalSearch.trim().toLowerCase();
    if (!q) return [] as OrganizedService[];
    const isIdSearch = /^\d+$/.test(q);
    return allServices.filter(s => {
      if (isIdSearch) {
        const displayId = getDisplayServiceId(s.id);
        return displayId === q || displayId.includes(q);
      }
      const terms = q.split(/\s+/);
      const name = s.name.toLowerCase();
      const displayId = getDisplayServiceId(s.id).toLowerCase();
      return terms.every(t => name.includes(t) || displayId.includes(t));
    }).slice(0, 100);
  }, [allServices, debouncedGlobalSearch]);

  // Categories filtered by category-search input (only when dropdown is open)
  const filteredCategories = useMemo(() => {
    const q = debouncedCategorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, debouncedCategorySearch]);

  // Services in selected category (no in-list search; selection is via dropdown)
  const categoryServices = useMemo(() => {
    if (!selectedCategory) return [] as OrganizedService[];
    const cat = organizedCategories.find(c => c.category === selectedCategory);
    return cat ? cat.services : [];
  }, [organizedCategories, selectedCategory]);

  const resetOrderFields = () => {
    setOrderQuantity("");
    setCustomComments("");
    setDripFeedEnabled(false);
    setDripFeedRuns("");
    setDripFeedInterval("");
    setAutoUsername("");
    setAutoMin("");
    setAutoMax("");
    setAutoPosts("");
    setAutoOldPosts("");
    setAutoDelay("");
    setAutoExpiry("");
    setTrafficKeywords("");
  };

  const selectService = useCallback((service: OrganizedService) => {
    setSelectedService(service);
    setServiceDropdownOpen(false);
    resetOrderFields();
    if (service.originalCategory && service.originalCategory !== selectedCategory) {
      setSelectedCategory(service.originalCategory);
    }
  }, [selectedCategory]);

  // Pre-select service from query params (?serviceId=...) for re-order flow
  useEffect(() => {
    const sid = searchParams.get("serviceId");
    if (!sid || allServices.length === 0 || selectedService?.id === sid) return;
    const match = allServices.find(s => s.id === sid);
    if (match) {
      setSelectedService(match);
      if (match.originalCategory) setSelectedCategory(match.originalCategory);
      setOrderLink("");
      resetOrderFields();
    }
  }, [searchParams, allServices, selectedService]);

  // Charge calculation — handles Auto-services (avg(min,max) * posts) and standard
  const charge = useMemo(() => {
    if (!selectedService) return 0;
    const rate = selectedService.markedUpRate;
    const isPerOne = selectedService.min_order === 1 && selectedService.max_order === 1;
    const isFixedPerN = selectedService.min_order === selectedService.max_order && selectedService.min_order >= 1;

    if (isAutoService(selectedService)) {
      const min = parseInt(autoMin) || 0;
      const max = parseInt(autoMax) || 0;
      const posts = parseInt(autoPosts) || 0;
      const oldPosts = hasOldPostsField(selectedService) ? (parseInt(autoOldPosts) || 0) : 0;
      if (min <= 0 || max <= 0 || max < min || (posts + oldPosts) <= 0) return 0;
      const avg = (min + max) / 2;
      const totalUnits = avg * (posts + oldPosts);
      return isPerOne ? totalUnits * rate : (totalUnits / 1000) * rate;
    }

    // Fixed-quantity packages (per-1, per-2, etc): charge = min_order * rate (or /1000 if rate is per-1000)
    if (isFixedQuantityService(selectedService)) {
      const qty = selectedService.min_order;
      return isPerOne || isFixedPerN ? qty * rate : (qty / 1000) * rate;
    }

    if (!orderQuantity) return 0;
    const qty = parseInt(orderQuantity) || 0;
    const runs = dripFeedEnabled ? parseInt(dripFeedRuns || "1") || 1 : 1;
    const totalQty = qty * runs;
    return isPerOne ? totalQty * rate : (totalQty / 1000) * rate;
  }, [selectedService, orderQuantity, dripFeedEnabled, dripFeedRuns, autoMin, autoMax, autoPosts, autoOldPosts]);


  const getFriendlyErrorMessage = (error: string): string => {
    if (error === 'USER_INSUFFICIENT_BALANCE') return "Insufficient balance. Please add funds.";
    if (error === 'PROVIDER_ERROR') return "Something went wrong. Please try again.";
    const lowerError = error.toLowerCase();
    if (lowerError.includes('not authenticated') || lowerError.includes('session')) return "Your session has expired. Please sign in again.";
    if (lowerError.includes('service not found')) return "This service is no longer available.";
    if (lowerError.includes('profile not found')) return "We couldn't find your account. Please try signing out and back in.";
    if (lowerError.includes('missing required fields') || lowerError.includes('invalid')) return "Please check that all fields are filled in correctly.";
    if (lowerError.includes('link')) return "Please enter a valid link for this service.";
    if (lowerError.includes('quantity') || lowerError.includes('min') || lowerError.includes('max')) return "The quantity you entered is outside the allowed range.";
    if (lowerError.includes('provider') || lowerError.includes('key not configured')) return "This service is temporarily unavailable.";
    return "Something went wrong. Please try again.";
  };

  const extractFunctionErrorCode = async (err: unknown): Promise<string> => {
    if (!err) return "";
    try {
      if (err instanceof FunctionsHttpError) {
        const body: any = await err.context.json().catch(() => null);
        if (body?.error && typeof body.error === "string") return body.error;
      }
    } catch {}
    const anyErr = err as any;
    return anyErr?.error || anyErr?.details || anyErr?.message || "";
  };

  const isValidServiceLink = (link: string): boolean => {
    const trimmed = link.trim();
    if (!trimmed) return false;
    // Accept full URLs
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (u.hostname.includes('.')) return true;
    } catch {}
    // Accept usernames (alphanumeric, dot, underscore, dash, @) for username-based services
    if (/^@?[a-zA-Z0-9._-]{2,}$/.test(trimmed)) return true;
    return false;
  };

  const handlePlaceOrder = async () => {
    if (!selectedService) {
      toast.error("Please select a service");
      return;
    }
    if (placingOrder) return;

    const isAuto = isAutoService(selectedService);
    const isTrafficExtra = needsTrafficExtraField(selectedService);
    const isIgAuto = isInstagramAutoService(selectedService);

    const body: Record<string, any> = { service_id: selectedService.id };

    if (isAuto) {
      const username = autoUsername.trim();
      const min = parseInt(autoMin);
      const max = parseInt(autoMax);
      const posts = parseInt(autoPosts);
      const oldPosts = isIgAuto ? parseInt(autoOldPosts || "0") : 0;
      const delay = autoDelay === "" ? 0 : parseInt(autoDelay);

      if (!username || !/^@?[a-zA-Z0-9._-]{2,}$/.test(username)) {
        toast.error("Please enter a valid username"); return;
      }
      if (!Number.isInteger(min) || min < selectedService.min_order) {
        toast.error(`Min must be at least ${selectedService.min_order}`); return;
      }
      if (!Number.isInteger(max) || max > selectedService.max_order || max < min) {
        toast.error(`Max must be between ${min || selectedService.min_order} and ${selectedService.max_order}`); return;
      }
      if (!Number.isInteger(posts) || posts < 0) { toast.error("Enter a valid number of new posts"); return; }
      if (isIgAuto && (!Number.isInteger(oldPosts) || oldPosts < 0)) { toast.error("Enter a valid number of old posts"); return; }
      if ((posts + oldPosts) <= 0) { toast.error("Enter at least one post (new or old)"); return; }
      if (!Number.isInteger(delay) || !delayOptions.includes(delay)) { toast.error("Please select a valid delay"); return; }
      if (autoExpiry && autoExpiry < todayIso()) { toast.error("Expiry date cannot be in the past"); return; }

      body.username = username.replace(/^@/, '');
      body.min = min;
      body.max = max;
      body.posts = posts;
      if (isIgAuto) body.old_posts = oldPosts;
      body.delay = delay;
      if (autoExpiry) body.expiry = autoExpiry;
    } else if (isTrafficExtra) {
      if (!orderLink || !isValidServiceLink(orderLink)) { toast.error("Please enter a valid link"); return; }
      if (!orderQuantity) { toast.error("Please enter a quantity"); return; }
      const quantity = parseInt(orderQuantity);
      if (quantity < selectedService.min_order || quantity > selectedService.max_order) {
        toast.error(`Quantity must be between ${selectedService.min_order} and ${selectedService.max_order}`); return;
      }
      const extra = trafficKeywords.trim();
      const labelForExtra = isHashtagService(selectedService) ? "hashtag" : isBrandSearchesService(selectedService) ? "username" : "keyword";
      if (!extra) { toast.error(`Enter a ${labelForExtra}`); return; }
      body.link = orderLink;
      body.quantity = quantity;
      if (isHashtagService(selectedService)) body.hashtag = extra.replace(/^#/, '');
      else if (isBrandSearchesService(selectedService)) body.usernames = extra.replace(/^@/, '');
      else body.keywords = extra;

    } else if (isFixedQuantityService(selectedService)) {
      if (!orderLink || !isValidServiceLink(orderLink)) { toast.error("Please enter a valid link"); return; }
      body.link = orderLink;
      body.quantity = selectedService.min_order; // always 1 for these packages
    } else {
      if (!orderLink || !orderQuantity) { toast.error("Please fill all required fields"); return; }
      if (!isValidServiceLink(orderLink)) { toast.error("Please enter a valid link or username"); return; }
      const quantity = parseInt(orderQuantity);
      if (quantity < selectedService.min_order || quantity > selectedService.max_order) {
        toast.error(`Quantity must be between ${selectedService.min_order} and ${selectedService.max_order}`); return;
      }
      if (dripFeedEnabled) {
        const interval = parseInt(dripFeedInterval);
        if (!dripFeedInterval || isNaN(interval) || interval < 1) { toast.error("Incorrect interval"); return; }
      }
      body.link = orderLink;
      body.quantity = quantity;
      if (customComments) body.comments = customComments;
      if (dripFeedEnabled) {
        body.runs = parseInt(dripFeedRuns) || undefined;
        body.interval = parseInt(dripFeedInterval) || undefined;
      }
    }

    setPlacingOrder(true);
    toast.loading("Placing your order...", { id: "placing-order" });

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        toast.dismiss("placing-order");
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("place-order", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });

      toast.dismiss("placing-order");

      if (data?.error) { toast.error(getFriendlyErrorMessage(data.error)); return; }
      if (error) { toast.error(getFriendlyErrorMessage(await extractFunctionErrorCode(error))); return; }

      toast.success(`Order placed! Total cost: ${formatPrice(charge)}`);
      if (user?.id) fetchUserBalance(user.id);
      setSelectedService(null);
      setOrderLink("");
      resetOrderFields();
      navigate("/dashboard");
    } catch (error: any) {
      toast.dismiss("placing-order");
      toast.error(getFriendlyErrorMessage(error?.message || ""));
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8"><FullPageLoader message="Loading services..." /></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background touch-manipulation">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">New Order</h1>
            <p className="text-muted-foreground text-sm">Place a new SMM service order</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Balance: </span>
              <span className="font-bold text-primary">{formatPrice(userBalance)}</span>
            </div>
            {isAdmin && (
              <Button onClick={syncAndFetchServices} disabled={syncing} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </Button>
            )}
          </div>
        </div>

        <ServiceNotifications />

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Top: Search By Service (across ALL services) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Search By Service</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search any service by name or ID (e.g. 4506)..."
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    if (e.target.value) {
                      setCategoryDropdownOpen(false);
                      setServiceDropdownOpen(false);
                    }
                  }}
                  onFocus={() => {
                    setCategoryDropdownOpen(false);
                    setServiceDropdownOpen(false);
                  }}
                  className="pl-9 pr-9 text-sm"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {debouncedGlobalSearch.trim() && !categoryDropdownOpen && !serviceDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 border border-border rounded-md bg-popover shadow-lg max-h-[300px] overflow-y-auto">
                    {globalSearchResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No services found</div>
                    ) : (
                      globalSearchResults.map(service => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => { selectService(service); setGlobalSearch(""); }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex-1 leading-snug">
                              <span className="text-muted-foreground">ID {getDisplayServiceId(service.id)}</span>
                              {' — '}
                              {service.name}
                            </span>
                            <span className="text-xs font-medium text-primary whitespace-nowrap mt-0.5">
                              {formatPrice(service.markedUpRate)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Category dropdown with category-only search inside */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Category</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDropdownOpen(o => {
                      const next = !o;
                      if (next) {
                        setGlobalSearch("");
                        setServiceDropdownOpen(false);
                      }
                      return next;
                    });
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <span className={selectedCategory ? "" : "text-muted-foreground"}>
                    {selectedCategory || "Select a category"}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {categoryDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-border bg-popover sticky top-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          autoFocus
                          placeholder="Search categories..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto">
                      {filteredCategories.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">No categories found</div>
                      ) : (
                        filteredCategories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setSelectedService(null);
                              setCategoryDropdownOpen(false);
                              setCategorySearch("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-b-0 ${
                              selectedCategory === cat ? 'bg-accent font-medium' : ''
                            }`}
                          >
                            {cat}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Service selector (within selected category) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Service</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCategory) return;
                    setServiceDropdownOpen(o => {
                      const next = !o;
                      if (next) {
                        setGlobalSearch("");
                        setCategoryDropdownOpen(false);
                      }
                      return next;
                    });
                  }}
                  disabled={!selectedCategory}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className={selectedService ? "" : "text-muted-foreground truncate"}>
                    {selectedService
                      ? `ID ${getDisplayServiceId(selectedService.id)} — ${selectedService.name}`
                      : selectedCategory
                        ? "Select a service"
                        : "Select a category first"}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 ml-2 transition-transform ${serviceDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {serviceDropdownOpen && selectedCategory && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
                    {categoryServices.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No services in this category</div>
                    ) : (
                      categoryServices.map(service => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => selectService(service)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-b-0 ${
                            selectedService?.id === service.id ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex-1 leading-snug">
                              <span className="text-muted-foreground">ID {getDisplayServiceId(service.id)}</span>
                              {' — '}
                              {service.name}
                            </span>
                            <span className="text-xs font-medium text-primary whitespace-nowrap mt-0.5">
                              {formatPrice(service.markedUpRate)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected service info */}
              {selectedService && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md border text-sm">
                  <div className="font-medium">
                    <span className="text-muted-foreground">ID {getDisplayServiceId(selectedService.id)}</span>
                    {' — '}
                    {selectedService.name}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span>Min: {selectedService.min_order.toLocaleString()}</span>
                    <span>Max: {selectedService.max_order.toLocaleString()}</span>
                    <span>Rate: {formatPrice(selectedService.markedUpRate)}</span>
                    {selectedService.average_time && <span>Avg: {selectedService.average_time}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* === AUTO-SERVICE FORM (subscriptions: TikTok Auto, Instagram Auto, etc.) === */}
            {isAutoService(selectedService) ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Username <span className="text-destructive">*</span></Label>
                  <Input
                    value={autoUsername}
                    onChange={(e) => setAutoUsername(e.target.value)}
                    placeholder="username (no @, no full URL)"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Profile username only. Account must be public.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Min per post <span className="text-destructive">*</span></Label>
                    <Input type="number" value={autoMin} onChange={(e) => setAutoMin(e.target.value)}
                      placeholder={`Min ${selectedService!.min_order}`} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Max per post <span className="text-destructive">*</span></Label>
                    <Input type="number" value={autoMax} onChange={(e) => setAutoMax(e.target.value)}
                      placeholder={`Max ${selectedService!.max_order}`} className="text-sm" />
                  </div>
                </div>

                <div className={`grid ${isInstagramAutoService(selectedService) ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">New posts <span className="text-destructive">*</span></Label>
                    <Input type="number" value={autoPosts} onChange={(e) => setAutoPosts(e.target.value)}
                      placeholder="Future posts to cover" min={0} className="text-sm" />
                  </div>
                  {isInstagramAutoService(selectedService) && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Old posts</Label>
                      <Input type="number" value={autoOldPosts} onChange={(e) => setAutoOldPosts(e.target.value)}
                        placeholder="Past posts to include" min={0} className="text-sm" />
                      <p className="text-xs text-muted-foreground">Applies to posts already on the profile.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Delay (min)</Label>
                    <select
                      value={autoDelay}
                      onChange={(e) => setAutoDelay(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {delayOptions.map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes === 0 ? "No delay" : `${minutes} minutes`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Expiry (optional)</Label>
                    <Input type="date" value={autoExpiry} onChange={(e) => setAutoExpiry(e.target.value)}
                      min={todayIso()} className="text-sm" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Link */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Link</Label>
                  <Input
                    value={orderLink}
                    onChange={(e) => setOrderLink(e.target.value)}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>

                {/* Custom Comments for comment services */}
                {isCustomCommentService(selectedService) && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Custom Comments <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={customComments}
                      onChange={(e) => {
                        setCustomComments(e.target.value);
                        const lineCount = getCommentLineCount(e.target.value);
                        setOrderQuantity(lineCount > 0 ? lineCount.toString() : "");
                      }}
                      placeholder="Enter your comments here, one per line..."
                      className="text-sm min-h-[100px]"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Each line = 1 comment. <span className="font-semibold text-primary">{getCommentLineCount(customComments)}</span> comment(s).
                      {selectedService && ` Min: ${selectedService.min_order}, Max: ${selectedService.max_order}`}
                    </p>
                  </div>
                )}

                {/* Keywords / hashtag / brand-searches usernames for special traffic services (single line) */}
                {needsTrafficExtraField(selectedService) && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      {isHashtagService(selectedService)
                        ? "Hashtag"
                        : isBrandSearchesService(selectedService)
                          ? "Username / Brand"
                          : "Keyword"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={trafficKeywords}
                      onChange={(e) => setTrafficKeywords(e.target.value.replace(/\n/g, ' '))}
                      placeholder={isHashtagService(selectedService)
                        ? "yourbrand+country"
                        : isBrandSearchesService(selectedService)
                          ? "yourbrand"
                          : "example keyword"}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isHashtagService(selectedService)
                        ? "Enter a single hashtag. No need to include the # symbol. Example: 'yourbrand+france' targets your brand in that country."
                        : isBrandSearchesService(selectedService)
                          ? "Enter a single brand or username. Example: 'yourbrand'. Real people will search this term in Google."
                          : "A single keyword/phrase — visitors arrive via this search term."}
                    </p>
                  </div>
                )}



                {/* Quantity — hidden for custom comments and fixed-quantity packages */}
                {!isCustomCommentService(selectedService) && !isFixedQuantityService(selectedService) && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Quantity</Label>
                    <Input
                      type="number"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      placeholder={selectedService ? `Min: ${selectedService.min_order} — Max: ${selectedService.max_order}` : "Select a service first"}
                      min={selectedService?.min_order}
                      max={selectedService?.max_order}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Fixed-quantity packages: show informational note instead of input */}
                {isFixedQuantityService(selectedService) && (
                  <p className="text-xs text-muted-foreground">
                    This is a fixed package — quantity is set automatically by the service ({selectedService!.min_order}).
                  </p>
                )}

                {/* Read-only quantity for custom comment */}
                {isCustomCommentService(selectedService) && getCommentLineCount(customComments) > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Quantity (auto-calculated)</Label>
                    <Input type="number" value={orderQuantity} readOnly className="text-sm bg-muted" />
                  </div>
                )}
              </>
            )}

            {/* Drip-feed */}
            {selectedService?.dripfeed && !isAutoService(selectedService) && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dripfeed"
                    checked={dripFeedEnabled}
                    onCheckedChange={(checked) => setDripFeedEnabled(checked === true)}
                  />
                  <Label htmlFor="dripfeed" className="text-sm cursor-pointer font-medium">Drip-feed</Label>
                </div>
                {dripFeedEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Runs</Label>
                      <Input
                        type="number"
                        value={dripFeedRuns}
                        onChange={(e) => setDripFeedRuns(e.target.value)}
                        placeholder="Runs"
                        min={1}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interval (min)</Label>
                      <Input
                        type="number"
                        value={dripFeedInterval}
                        onChange={(e) => setDripFeedInterval(e.target.value)}
                        placeholder="Minutes"
                        min={1}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
                {dripFeedEnabled && orderQuantity && parseInt(orderQuantity) > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/60 text-sm">
                    <span className="text-muted-foreground">Total Quantity</span>
                    <span className="font-semibold text-foreground">
                      {(parseInt(orderQuantity) * (parseInt(dripFeedRuns || "1") || 1)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Charge — Auto-services bill on detection */}
            {charge > 0 && isAutoService(selectedService) && (
              <div className="p-3 sm:p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="font-medium">Estimated max charge</span>
                  <span className="font-bold text-lg text-primary">{formatPrice(charge)}</span>
                </div>
                <p className="text-xs text-foreground">
                  When you place this subscription, the <span className="font-semibold">maximum possible cost</span> (max × posts) is reserved from your balance so it cannot be spent elsewhere. You are only actually charged each time a new post is detected and delivered — any unused reservation is released back to your balance when the subscription ends.
                </p>
              </div>
            )}

            {charge > 0 && !isAutoService(selectedService) && (
              <div className="p-3 sm:p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="font-medium">Charge</span>
                  <span className="font-bold text-lg text-primary">{formatPrice(charge)}</span>
                </div>
              </div>
            )}

            {/* Auto-service field explainer */}
            {isAutoService(selectedService) && (
              <div className="p-3 sm:p-4 rounded-lg border bg-muted/30 text-foreground space-y-2 text-xs sm:text-sm">
                <p className="font-semibold text-primary">How auto-services work</p>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li><span className="font-medium">Username</span> — your public profile handle. The system watches it for new posts.</li>
                  <li><span className="font-medium">Min / Max per post</span> — random range delivered to each new post (e.g. 100–300 likes per post).</li>
                  <li><span className="font-medium">New posts</span> — how many future uploads this subscription covers.</li>
                  {isInstagramAutoService(selectedService) && (
                    <li><span className="font-medium">Old posts</span> — apply the service to that many recent existing posts on the profile too.</li>
                  )}
                  <li><span className="font-medium">Delay</span> — wait time (in minutes) after a new post is detected before delivery starts.</li>
                  <li><span className="font-medium">Expiry</span> — optional date when the subscription auto-stops.</li>
                </ul>
                <p className="pt-1"><span className="font-semibold">Billing:</span> automatic per detected post. Insufficient balance = post skipped. Account must stay public.</p>
              </div>
            )}

            {/* Description — full text, no scroll/truncation */}
            {selectedService?.description && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                <div className="p-3 bg-muted/30 border rounded-md text-xs sm:text-sm whitespace-pre-line break-words">
                  {selectedService.description}
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handlePlaceOrder}
              className="w-full h-11"
              disabled={
                placingOrder || !selectedService ||
                (isAutoService(selectedService)
                  ? (!autoUsername || !autoMin || !autoMax || !autoPosts)
                  : isFixedQuantityService(selectedService)
                    ? !orderLink
                    : (!orderLink || !orderQuantity))
              }
            >
              {placingOrder ? "Placing Order..." : "Submit Order"}
            </Button>

            {/* Important info notice */}
            <div className="mt-2 p-3 rounded-md border border-primary/30 bg-primary/5 text-foreground text-xs sm:text-sm leading-relaxed">
              <span className="font-semibold text-primary">Important:</span> Read the service name and description carefully. Cheap services may drop more. Stable services usually cost more but perform better.
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
      <FloatingNotificationBell />
    </div>
  );
};

export default Services;
