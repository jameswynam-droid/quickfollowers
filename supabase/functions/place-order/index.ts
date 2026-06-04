import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  service_id: string;
  // Standard
  link?: string;
  quantity?: number;
  comments?: string;
  runs?: number;
  interval?: number;
  // Website traffic keywords
  keywords?: string;
  hashtag?: string;
  // Auto-service (subscriptions)
  username?: string;
  min?: number;
  max?: number;
  posts?: number;
  old_posts?: number;
  delay?: number;
  expiry?: string; // YYYY-MM-DD from frontend date picker
}

const MARKUP_RATES = { standard: 0.10, premium: 0.15 };

const isPremiumService = (name: string, category: string): boolean => {
  const premiumKeywords = [
    'nigerian', 'nigeria', '🇳🇬',
    'share', 'shares', 'save', 'saves',
    'recovery', 'disabled',
    'premium', 'verified', 'bluetick',
    'boost', 'no drop', 'non drop',
    'some',
  ];
  const text = `${name} ${category}`.toLowerCase();
  return premiumKeywords.some(k => text.includes(k));
};

const calculateMarkup = (rate: number, isPremium: boolean): number =>
  rate * (1 + (isPremium ? MARKUP_RATES.premium : MARKUP_RATES.standard));

const detectAutoService = (service: any): boolean => {
  const t = (service.type || '').toLowerCase();
  const n = (service.name || '').toLowerCase();
  const blob = `${service.name || ''} ${service.category || ''}`.toLowerCase();
  const isTargetPlatform = blob.includes('instagram') || blob.includes('tiktok') || blob.includes('tik tok');
  return isTargetPlatform && (t.includes('subscription') || /\bauto\b/.test(n));
};

const detectInstagramAuto = (service: any): boolean => {
  if (!detectAutoService(service)) return false;
  const blob = `${service.name} ${service.category}`.toLowerCase();
  return blob.includes('instagram');
};

const detectTrafficKeywords = (service: any): boolean => {
  const blob = `${service.name} ${service.category} ${service.description || ''} ${service.type || ''}`.toLowerCase();
  return blob.includes('traffic') && /(keyword|seo)/.test(blob) && !blob.includes('hashtag');
};

const detectHashtagService = (service: any): boolean => {
  const blob = `${service.name} ${service.category} ${service.description || ''} ${service.type || ''}`.toLowerCase();
  return blob.includes('hashtag') || (blob.includes('traffic') && blob.includes('mentions hashtag'));
};

const toProviderExpiry = (expiry: string): string => {
  const [year, month, day] = expiry.split('-');
  return `${day}/${month}/${year}`;
};

// Convert YYYY-MM-DD to d/m/Y
const formatExpiry = (dateStr: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) throw new Error('Missing JWT');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) throw new Error('Not authenticated');

    const body: OrderRequest = await req.json();
    const {
      service_id, link, quantity, comments, runs, interval,
      keywords, username, min, max, posts, old_posts, delay, expiry,
    } = body;

    if (!service_id) throw new Error('Missing required fields');

    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();
    if (serviceError || !service) throw new Error('Service not found');

    const provider = service.provider;
    const actualServiceId = parseInt(service_id.toString().split('-')[1] || service_id.toString());
    const isPremium = isPremiumService(service.name, service.category);
    const markedUpRate = calculateMarkup(Number(service.rate), isPremium);
    const isPerOne = service.min_order === 1 && service.max_order === 1;

    const isAuto = detectAutoService(service);
    const isIgAuto = detectInstagramAuto(service);
    const isTraffic = detectTrafficKeywords(service);

    let charge = 0;
    let recordedQuantity = 0;
    const orderPayload: Record<string, any> = {
      key: '', 
      action: 'add',
      service: actualServiceId,
    };

    if (isAuto) {
      if (!username || typeof username !== 'string' || !/^@?[a-zA-Z0-9._-]{2,}$/.test(username)) {
        throw new Error('Invalid username');
      }
      if (!Number.isInteger(min) || !Number.isInteger(max) || (min as number) < service.min_order || (max as number) > service.max_order || (max as number) < (min as number)) {
        throw new Error('Invalid min/max range');
      }
      if (!Number.isInteger(posts) || (posts as number) < 0) throw new Error('Invalid posts');
      const op = isIgAuto && Number.isInteger(old_posts) ? (old_posts as number) : 0;
      if (op < 0) throw new Error('Invalid old_posts');
      if (((posts as number) + op) <= 0) throw new Error('At least one post required');
      
      const avg = ((min as number) + (max as number)) / 2;
      const totalUnits = avg * ((posts as number) + op);
      charge = parseFloat((isPerOne ? totalUnits * markedUpRate : (totalUnits * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = Math.round(totalUnits);

      orderPayload.username = (username as string).replace(/^@/, '');
      orderPayload.min = min;
      orderPayload.max = max;
      orderPayload.posts = posts;
      if (isIgAuto) orderPayload.old_posts = op;
      if (delay !== undefined) orderPayload.delay = delay;
      if (expiry) orderPayload.expiry = formatExpiry(expiry);
    } else if (isTraffic) {
      if (!link || typeof link !== 'string' || !/^https?:\/\/.+/.test(link) || link.length > 500) throw new Error('Invalid link');
      if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('Invalid quantity');
      if (!keywords || typeof keywords !== 'string' || !keywords.trim()) throw new Error('Keywords required');

      charge = parseFloat((isPerOne ? (quantity as number) * markedUpRate : ((quantity as number) * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = quantity as number;

      orderPayload.link = link;
      orderPayload.quantity = quantity;
      orderPayload.keywords = keywords;
    } else {
      if (!link || typeof link !== 'string') throw new Error('Invalid link');
      if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('Invalid quantity');
      if ((quantity as number) < service.min_order || (quantity as number) > service.max_order) throw new Error('Quantity out of range');

      const totalQuantity = (runs && runs > 1) ? (quantity as number) * runs : (quantity as number);
      charge = parseFloat((isPerOne ? totalQuantity * markedUpRate : (totalQuantity * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = totalQuantity;

      orderPayload.link = link;
      orderPayload.quantity = quantity;
      if (runs && runs > 1 && interval) {
        orderPayload.runs = runs;
        orderPayload.interval = interval;
      }
      if (comments) orderPayload.comments = comments;
    }

    // Balance check
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles').select('id, balance').eq('id', user.id).single();
    if (profileError || !profile) throw new Error('Profile not found');

    if (Number(profile.balance) < charge) {
      return new Response(JSON.stringify({ error: 'USER_INSUFFICIENT_BALANCE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Provider keys
    let apiUrl: string;
    let apiKey: string | undefined;
    if (provider === 'owlet') { apiUrl = 'https://therealowlet.com/api/v2'; apiKey = Deno.env.get('OWLET_API_KEY'); }
    else if (provider === 'smmfollows') { apiUrl = 'https://smmfollows.com/api/v2'; apiKey = Deno.env.get('SMMFOLLOWS_API_KEY'); }
    else if (provider === 'followspanel') { apiUrl = 'https://followspanel.com/api/v2'; apiKey = Deno.env.get('FOLLOWSPANEL_API_KEY'); }
    else throw new Error(`Unknown provider: ${provider}`);
    
    if (!apiKey) throw new Error(`API key not configured for provider: ${provider}`);
    orderPayload.key = apiKey;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    const apiResult = await apiResponse.json();

    if (!apiResponse.ok || !apiResult.order) {
      const apiError = (apiResult.error || '').toLowerCase();
      const failureReason = apiResult.error || 'Unknown API error';
      
      if (apiError.includes('insufficient') || apiError.includes('balance') || apiError.includes('funds')) {
        return new Response(JSON.stringify({ error: 'PROVIDER_ERROR' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      throw new Error(failureReason);
    }

    // Save order with ALL fields
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: profile.id,
        service_id: service.id,
        link: isAuto ? `@${(username || '').replace(/^@/, '')}` : (link || ''),
        quantity: recordedQuantity,
        charge,
        status: 'processing',
        api_order_id: apiResult.order.toString(),
        // Extra fields
        runs: runs || null,
        interval_minutes: interval || null,
        comments: comments || null,
        keywords: keywords || null,
        username: isAuto ? (username || '').replace(/^@/, '') : null,
        min: min || null,
        max: max || null,
        posts: posts || null,
        old_posts: isIgAuto ? (old_posts || 0) : null,
        delay: delay || null,
        expiry: expiry || null,
      })
      .select().single();
    
    if (orderError) {
      console.error('Order saving error:', orderError);
      // Even if saving order record fails, we've placed it at provider and must deduct balance if possible
      // But usually this means a schema mismatch
    }

    const newBalance = parseFloat(profile.balance as any) - charge;
    await supabaseAdmin.from('profiles').update({ balance: newBalance }).eq('id', profile.id);

    await supabaseAdmin.from('transactions').insert({
      user_id: profile.id, amount: -charge, type: 'order',
      reference_id: order?.id, description: `Order: ${service.name}`,
      balance_after: newBalance,
    });

    return new Response(JSON.stringify({ success: true, order, message: 'Order placed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});
