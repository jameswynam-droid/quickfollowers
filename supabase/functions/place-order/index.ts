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
  // Auto-service (subscriptions)
  username?: string;
  min?: number;
  max?: number;
  posts?: number;
  old_posts?: number;
  delay?: number;
  expiry?: string; // YYYY-MM-DD
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

const detectAutoService = (service: any): boolean => {
  const t = (service.type || '').toLowerCase();
  const n = (service.name || '').toLowerCase();
  return t.includes('subscription') || /\bauto\b/.test(n);
};

const detectInstagramAuto = (service: any): boolean => {
  if (!detectAutoService(service)) return false;
  const blob = `${service.name} ${service.category}`.toLowerCase();
  return blob.includes('instagram');
};

const detectTrafficKeywords = (service: any): boolean => {
  const blob = `${service.name} ${service.category} ${service.description || ''}`.toLowerCase();
  return blob.includes('traffic') && /(keyword|hashtag)/.test(blob);
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
    if (typeof service_id !== 'string' || service_id.length > 100) throw new Error('Invalid service ID');

    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();
    if (serviceError || !service) throw new Error('Service not found');

    const provider = service.provider;
    const actualServiceId = service_id.split('-')[1];
    const isPremium = isPremiumService(service.name, service.category);
    const markedUpRate = calculateMarkup(Number(service.rate), isPremium);
    const isPerOne = service.min_order === 1 && service.max_order === 1;

    const isAuto = detectAutoService(service);
    const isIgAuto = detectInstagramAuto(service);
    const isTraffic = detectTrafficKeywords(service);

    // ---- Validate per service type & compute charge + provider payload ----
    let charge = 0;
    let recordedQuantity = 0;
    const orderPayload: Record<string, any> = {
      key: '', // filled below
      service: parseInt(actualServiceId),
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
      if (delay !== undefined && (!Number.isInteger(delay) || (delay as number) < 0 || (delay as number) > 1440)) {
        throw new Error('Invalid delay');
      }
      if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new Error('Invalid expiry');

      const avg = ((min as number) + (max as number)) / 2;
      const totalUnits = avg * ((posts as number) + op);
      charge = parseFloat((isPerOne ? totalUnits * markedUpRate : (totalUnits * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = Math.round(totalUnits);

      orderPayload.action = 'subscriptions';
      orderPayload.username = (username as string).replace(/^@/, '');
      orderPayload.min = min;
      orderPayload.max = max;
      orderPayload.posts = posts;
      if (isIgAuto) orderPayload.old_posts = op;
      if (delay !== undefined) orderPayload.delay = delay;
      if (expiry) orderPayload.expiry = expiry;
    } else if (isTraffic) {
      if (!link || typeof link !== 'string' || !/^https?:\/\/.+/.test(link) || link.length > 500) throw new Error('Invalid link');
      if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('Invalid quantity');
      if ((quantity as number) < service.min_order || (quantity as number) > service.max_order) throw new Error('Quantity out of range');
      if (!keywords || typeof keywords !== 'string' || !keywords.trim()) throw new Error('Keywords required');

      charge = parseFloat((isPerOne ? (quantity as number) * markedUpRate : ((quantity as number) * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = quantity as number;

      orderPayload.action = 'add';
      orderPayload.link = link;
      orderPayload.quantity = quantity;
      orderPayload.keywords = keywords;
    } else {
      if (!link || typeof link !== 'string' || !/^https?:\/\/.+/.test(link) || link.length > 500) throw new Error('Invalid link');
      if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('Invalid quantity');
      if ((quantity as number) < service.min_order || (quantity as number) > service.max_order) throw new Error('Quantity out of range');
      if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > 100)) throw new Error('Invalid runs');
      if (interval !== undefined && (!Number.isInteger(interval) || interval < 1 || interval > 1440)) throw new Error('Invalid interval');

      const totalQuantity = (runs && runs > 1) ? (quantity as number) * runs : (quantity as number);
      charge = parseFloat((isPerOne ? totalQuantity * markedUpRate : (totalQuantity * markedUpRate) / 1000).toFixed(2));
      recordedQuantity = totalQuantity;

      orderPayload.action = 'add';
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
      await supabaseAdmin.from('orders').insert({
        user_id: profile.id, service_id, link: link || username || '', quantity: recordedQuantity,
        charge: 0, status: 'failed', failure_reason: 'Insufficient balance',
      });
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
      await supabaseAdmin.from('orders').insert({
        user_id: profile.id, service_id, link: link || username || '', quantity: recordedQuantity,
        charge: 0, status: 'failed', failure_reason: failureReason,
      });
      if (apiError.includes('insufficient') || apiError.includes('balance') || apiError.includes('funds')) {
        return new Response(JSON.stringify({ error: 'PROVIDER_ERROR' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      throw new Error(failureReason);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: profile.id, service_id,
        link: link || `@${(username || '').replace(/^@/, '')}`,
        quantity: recordedQuantity, charge,
        status: 'processing', api_order_id: apiResult.order.toString(),
      })
      .select().single();
    if (orderError) throw orderError;

    const newBalance = parseFloat(profile.balance as any) - charge;
    const { error: updateError } = await supabaseAdmin
      .from('profiles').update({ balance: newBalance }).eq('id', profile.id);
    if (updateError) throw updateError;

    await supabaseAdmin.from('transactions').insert({
      user_id: profile.id, amount: -charge, type: 'order',
      reference_id: order.id, description: `Order: ${service.name}`,
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
