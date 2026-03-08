import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  service_id: string;
  link: string;
  quantity: number;
  comments?: string;
  runs?: number;
  interval?: number;
}

// Markup calculation - must match frontend serviceOrganizer.ts
const MARKUP_RATES = {
  standard: 0.10, // 10%
  premium: 0.15, // 15%
};

const isPremiumService = (name: string, category: string): boolean => {
  const premiumKeywords = [
    'nigerian', 'nigeria', '🇳🇬',
    'share', 'shares',
    'save', 'saves',
    'recovery', 'disabled',
    'premium', 'verified', 'bluetick',
    'boost', 'no drop', 'non drop'
  ];
  
  const text = `${name} ${category}`.toLowerCase();
  return premiumKeywords.some(keyword => text.includes(keyword));
};

const calculateMarkup = (rate: number, isPremium: boolean): number => {
  const markup = isPremium ? MARKUP_RATES.premium : MARKUP_RATES.standard;
  return rate * (1 + markup);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // In edge functions there is no browser storage/session.
    // Always pass the JWT explicitly to auth.getUser(jwt) instead of relying on an in-memory session.
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      throw new Error('Missing JWT');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    // Service role client for privileged operations (inserts with non-pending status, balance updates)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Not authenticated');
    }

    console.log('Authenticated user:', user.id);

    const { service_id, link, quantity, comments, runs, interval }: OrderRequest = await req.json();

    // Validate input - presence
    if (!service_id || !link || !quantity) {
      throw new Error('Missing required fields');
    }

    // Validate quantity is a positive integer
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Invalid quantity: must be a positive integer');
    }

    // Validate link format
    const linkPattern = /^https?:\/\/.+/;
    if (typeof link !== 'string' || !linkPattern.test(link) || link.length > 500) {
      throw new Error('Invalid link format');
    }

    // Validate service_id format
    if (typeof service_id !== 'string' || service_id.length > 100) {
      throw new Error('Invalid service ID');
    }

    // Validate optional drip-feed params
    if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > 100)) {
      throw new Error('Invalid runs value');
    }
    if (interval !== undefined && (!Number.isInteger(interval) || interval < 1 || interval > 1440)) {
      throw new Error('Invalid interval value');
    }

    // Get service details including provider
    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      console.error('Service error:', serviceError);
      throw new Error('Service not found');
    }

    // Extract provider and actual service ID from composite ID
    const provider = service.provider;
    const actualServiceId = service_id.split('-')[1];

    // Apply markup to calculate the user charge (same as frontend)
    const isPremium = isPremiumService(service.name, service.category);
    const markedUpRate = calculateMarkup(service.rate, isPremium);
    
    // Calculate charge with markup, accounting for drip-feed runs
    const totalQuantity = (runs && runs > 1) ? quantity * runs : quantity;
    const isPerOnePricing = service.min_order === 1 && service.max_order === 1;
    const charge = isPerOnePricing
      ? parseFloat((markedUpRate * totalQuantity).toFixed(2))
      : parseFloat(((markedUpRate * totalQuantity) / 1000).toFixed(2));

    console.log(`Service: ${service.name}, Original rate: ${service.rate}, Marked up rate: ${markedUpRate}, Quantity: ${quantity}, Charge: ${charge}`);

    // Check user balance - explicitly filter by user ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      throw new Error('Profile not found');
    }

    if (profile.balance < charge) {
      // Create a failed order record so the bot can see the reason
      await supabaseAdmin.from('orders').insert({
        user_id: profile.id,
        service_id: service_id,
        link: link,
        quantity: quantity,
        charge: 0,
        status: 'failed',
        failure_reason: 'Insufficient balance',
      });

      return new Response(
        JSON.stringify({ error: 'USER_INSUFFICIENT_BALANCE' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Determine API endpoint and key based on provider
    let apiUrl: string;
    let apiKey: string | undefined;

    if (provider === 'owlet') {
      apiUrl = 'https://therealowlet.com/api/v2';
      apiKey = Deno.env.get('OWLET_API_KEY');
    } else if (provider === 'smmfollows') {
      apiUrl = 'https://smmfollows.com/api/v2';
      apiKey = Deno.env.get('SMMFOLLOWS_API_KEY');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    console.log(`Placing order with ${provider} API...`);
    
    // Build the order payload
    const orderPayload: Record<string, any> = {
      key: apiKey,
      action: 'add',
      service: parseInt(actualServiceId),
      link: link,
      quantity: quantity,
    };

    // Add comments for custom comment services
    if (comments) {
      orderPayload.comments = comments;
    }

    // Add drip-feed parameters if provided
    if (runs && interval) {
      orderPayload.runs = runs;
      orderPayload.interval = interval;
    }

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const apiResult = await apiResponse.json();
    
    if (!apiResponse.ok || !apiResult.order) {
      const apiError = (apiResult.error || '').toLowerCase();
      const failureReason = apiResult.error || 'Unknown API error';
      
      // Check for provider-side insufficient funds errors
      if (apiError.includes('insufficient') || apiError.includes('balance') || apiError.includes('funds')) {
        console.error('Provider API balance error:', apiResult.error);
        
        // Store the failed order with reason
        await supabaseAdmin.from('orders').insert({
          user_id: profile.id,
          service_id: service_id,
          link: link,
          quantity: quantity,
          charge: 0,
          status: 'failed',
          failure_reason: failureReason,
        });
        
        return new Response(
          JSON.stringify({ error: 'PROVIDER_ERROR' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        );
      }
      
      // Store any other failed order with reason
      await supabaseAdmin.from('orders').insert({
        user_id: profile.id,
        service_id: service_id,
        link: link,
        quantity: quantity,
        charge: 0,
        status: 'failed',
        failure_reason: failureReason,
      });
      
      throw new Error(failureReason);
    }

    console.log(`Order placed successfully with ${provider} API:`, apiResult.order);

    // Create order record with marked up charge
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: profile.id,
        service_id: service_id,
        link: link,
        quantity: quantity,
        charge: charge,
        status: 'processing',
        api_order_id: apiResult.order.toString(),
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Deduct balance
    const newBalance = parseFloat(profile.balance) - charge;
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: profile.id,
        amount: -charge,
        type: 'order',
        reference_id: order.id,
        description: `Order: ${service.name}`,
        balance_after: newBalance,
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order,
        message: 'Order placed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error placing order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
