import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  service_id: string;
  link?: string;
  quantity?: number;
  comments?: string;
  runs?: number;
  interval?: number;
  keywords?: string;
  hashtag?: string;
  usernames?: string;
  username?: string;
  min?: number;
  max?: number;
  posts?: number;
  old_posts?: number;
  delay?: number;
  expiry?: string;
}

const MARKUP_RATES = { standard: 0.10, premium: 0.15 };

const isPremiumService = (name: string, category: string): boolean => {
  const premiumKeywords = [
    'nigerian', 'nigeria', '🇳🇬',
    'share', 'shares', 'save', 'saves',
    'recovery', 'disabled',
    'premium', 'verified', 'bluetick',
    'boost', 'no drop', 'non drop',
  ];
  const text = `${name} ${category}`.toLowerCase();
  return premiumKeywords.some(k => text.includes(k));
};

const calculateMarkup = (rate: number, isPremium: boolean): number =>
  rate * (1 + (isPremium ? MARKUP_RATES.premium : MARKUP_RATES.standard));

// ---- Classifier (mirror of frontend) ----
const isTelegram = (s: any) => `${s.name} ${s.category}`.toLowerCase().includes('telegram');
const isTikTokSvc = (s: any) => {
  const b = `${s.name} ${s.category}`.toLowerCase();
  return b.includes('tiktok') || b.includes('tik tok');
};
const isAutoMembers = (s: any) => /auto\s*(members?|followers?|subscribers?)/.test(`${s.name} ${s.category}`.toLowerCase());

const detectAutoService = (service: any): boolean => {
  const t = (service.type || '').toLowerCase();
  if (!t.includes('subscription')) return false;
  if (isAutoMembers(service)) return false;
  const blob = `${service.name} ${service.category}`.toLowerCase();
  const provider = service.provider || '';
  const rawSid = (service.id || '').toString().split('-')[1] || service.id?.toString() || '';

  if (rawSid === '7287') return false;
  if (rawSid === '7289' || rawSid === '6599' || rawSid === '7773') return true;

  if (isTelegram(service)) {
    if (provider === 'owlet') {
      return blob.includes('reaction') || blob.includes('ai-generated') || blob.includes('ai generated');
    }
    if (blob.includes('future post')) return false;
    if (blob.includes('by post count')) return false;
    return blob.includes('auto');
  }
  return true;
};

const detectHasOldPosts = (service: any): boolean => {
  if (!detectAutoService(service)) return false;
  const rawSid = (service.id || '').toString().split('-')[1] || service.id?.toString() || '';
  if (rawSid === '7289') return true;
  if (isTikTokSvc(service)) return false;
  return true;
};

const detectTrafficKeywords = (service: any): boolean => {
  const blob = `${service.name} ${service.category} ${service.description || ''} ${service.type || ''}`.toLowerCase();
  return blob.includes('traffic') && /(keyword|seo)/.test(blob) && !blob.includes('hashtag');
};

const detectHashtagService = (service: any): boolean => {
  const blob = `${service.name} ${service.category} ${service.description || ''} ${service.type || ''}`.toLowerCase();
  return blob.includes('hashtag') || (blob.includes('traffic') && blob.includes('mentions hashtag'));
};

const detectBrandSearches = (service: any): boolean =>
  (service.category || '').toLowerCase().includes('brand searches');

const detectFixedQuantity = (service: any): boolean => {
  if (detectAutoService(service)) return false;
  if (Number(service.min_order) !== Number(service.max_order)) return false;
  if (Number(service.min_order) < 1) return false;
  const t = (service.type || '').toLowerCase();
  return !t.includes('custom');
};

const toProviderExpiry = (expiry: string): string => {
  const [y, m, d] = expiry.split('-');
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

    // Note: admin restriction removed, only the standalone Admin Panel
    // (separate from normal user accounts) is restricted from ordering.


    const body: OrderRequest = await req.json();
    const {
      service_id, link, quantity, comments, runs, interval,
      keywords, hashtag, usernames, username, min, max, posts, old_posts, delay, expiry,
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
    const isFixedPerN = service.min_order === service.max_order && service.min_order >= 1;

    const isAuto = detectAutoService(service);
    const hasOldPosts = detectHasOldPosts(service);
    const isTraffic = detectTrafficKeywords(service);
    const isHashtag = detectHashtagService(service);
    const isBrand = detectBrandSearches(service);
    const isFixed = detectFixedQuantity(service);

    let charge = 0;
    let recordedQuantity = 0;
    let reservationAmount = 0; // only for auto-services
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
      const op = hasOldPosts && Number.isInteger(old_posts) ? (old_posts as number) : 0;
      if (op < 0) throw new Error('Invalid old_posts');
      if (((posts as number) + op) <= 0) throw new Error('At least one post required');
      const allowedDelays = [0, 5, 10, 15, 20, 30, 40, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600];
      if (delay !== undefined && (!Number.isInteger(delay) || !allowedDelays.includes(delay as number))) throw new Error('Invalid delay');
      if (expiry) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new Error('Invalid expiry');
        if (expiry < new Date().toISOString().slice(0, 10)) throw new Error('Expiry date cannot be in the past');
      }

      const avg = ((min as number) + (max as number)) / 2;
      const totalUnits = avg * ((posts as number) + op);
      charge = parseFloat((isPerOne ? totalUnits * markedUpRate : (totalUnits * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = Math.round(totalUnits);

      // Reserve the MAX possible cost (not avg)
      const maxUnits = (max as number) * ((posts as number) + op);
      reservationAmount = parseFloat((isPerOne ? maxUnits * markedUpRate : (maxUnits * markedUpRate) / 1000).toFixed(2));

      orderPayload.username = (username as string).replace(/^@/, '');
      orderPayload.min = min;
      orderPayload.max = max;
      orderPayload.posts = posts;
      if (hasOldPosts) orderPayload.old_posts = op;
      orderPayload.delay = delay ?? 0;
      if (expiry) orderPayload.expiry = toProviderExpiry(expiry);
    } else if (isTraffic || isHashtag || isBrand) {
      if (!link || typeof link !== 'string' || !/^https?:\/\/.+/.test(link) || link.length > 500) throw new Error('Invalid link');
      if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('Invalid quantity');
      if ((quantity as number) < service.min_order || (quantity as number) > service.max_order) throw new Error('Quantity out of range');
      if (isTraffic && (!keywords || typeof keywords !== 'string' || !keywords.trim())) throw new Error('Keywords required');
      if (isHashtag && (!hashtag || typeof hashtag !== 'string' || !hashtag.trim())) throw new Error('Hashtag required');
      if (isBrand && (!usernames || typeof usernames !== 'string' || !usernames.trim())) throw new Error('Usernames required');

      charge = parseFloat((isPerOne ? (quantity as number) * markedUpRate : ((quantity as number) * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = quantity as number;

      orderPayload.link = link;
      orderPayload.quantity = quantity;
      // Single-value, no newline splitting
      if (isTraffic) orderPayload.keywords = keywords!.trim();
      if (isHashtag) orderPayload.hashtag = hashtag!.trim().replace(/^#/, '');
      if (isBrand) orderPayload.usernames = usernames!.trim().replace(/^@/, '');
    } else if (isFixed) {
      if (!link || typeof link !== 'string') throw new Error('Invalid link');
      const qty = service.min_order;
      charge = parseFloat((isPerOne || isFixedPerN ? qty * markedUpRate : (qty * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = qty;
      orderPayload.link = link;
      orderPayload.quantity = qty;
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

    // Balance check, auto-services check available (balance - reserved) against RESERVATION amount,
    // not the avg charge, so user can't overspend reserved funds.
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles').select('id, balance, reserved_balance').eq('id', user.id).single();
    if (profileError || !profile) throw new Error('Profile not found');

    const available = Number(profile.balance) - Number(profile.reserved_balance || 0);
    const required = isAuto ? reservationAmount : charge;
    if (available < required) {
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

    // Save order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: profile.id,
        service_id: service.id,
        link: isAuto ? `@${(username || '').replace(/^@/, '')}` : (link || ''),
        quantity: recordedQuantity,
        charge: isAuto ? 0 : charge, // auto-services start at 0 charged; updated as posts deliver
        status: 'processing',
        api_order_id: apiResult.order.toString(),
        runs: runs || null,
        interval_minutes: interval || null,
      })
      .select().single();

    if (orderError) {
      console.error('Order saving error:', orderError);
    }

    if (isAuto) {
      // Reserve funds, do NOT debit balance. Insert reservation row.
      const newReserved = Number(profile.reserved_balance || 0) + reservationAmount;
      await supabaseAdmin.from('profiles').update({ reserved_balance: newReserved }).eq('id', profile.id);
      await supabaseAdmin.from('subscription_reservations').insert({
        user_id: profile.id,
        order_id: order?.id,
        api_subscription_id: apiResult.order.toString(),
        estimated_max: reservationAmount,
        charged_so_far: 0,
        status: 'active',
      });

      return new Response(JSON.stringify({
        success: true, order,
        message: `Subscription started. ${reservationAmount.toFixed(2)} reserved from balance.`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Standard order: debit immediately
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
