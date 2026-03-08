import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Markup calculation - must match frontend
const MARKUP_RATES = {
  standard: 0.10,
  premium: 0.15,
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

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      throw new Error('Missing JWT');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { order_id } = await req.json();

    if (!order_id || typeof order_id !== 'string' || order_id.length > 100) {
      throw new Error('Invalid order ID');
    }

    // Get original order details
    const { data: originalOrder, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, services(id, name, category, rate, provider, min_order, max_order)')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !originalOrder) {
      throw new Error('Order not found');
    }

    const service = originalOrder.services;
    if (!service) {
      throw new Error('Service not found for this order');
    }

    // Only allow reorder for Owlet services
    if (service.provider !== 'owlet') {
      throw new Error('Reorder is only available for Owlet services');
    }

    // Get user's current balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Calculate charge with markup
    const isPremium = isPremiumService(service.name, service.category);
    const markedUpRate = calculateMarkup(service.rate, isPremium);
    const charge = parseFloat(((markedUpRate * originalOrder.quantity) / 1000).toFixed(2));

    if (profile.balance < charge) {
      // Create a failed order record so the bot can see the reason
      await supabaseClient.from('orders').insert({
        user_id: profile.id,
        service_id: service.id,
        link: originalOrder.link,
        quantity: originalOrder.quantity,
        charge: 0,
        status: 'failed',
        failure_reason: 'Insufficient balance',
      });

      return new Response(
        JSON.stringify({ error: 'Insufficient balance. Please add funds.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Place the order with Owlet API
    const apiUrl = 'https://therealowlet.com/api/v2';
    const apiKey = Deno.env.get('OWLET_API_KEY');

    if (!apiKey) {
      throw new Error('Owlet API key not configured');
    }

    const actualServiceId = service.id.split('-')[1];

    console.log(`Placing reorder with Owlet API for service ${actualServiceId}`);
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        action: 'add',
        service: parseInt(actualServiceId),
        link: originalOrder.link,
        quantity: originalOrder.quantity,
      }),
    });

    const apiResult = await apiResponse.json();
    
    if (!apiResponse.ok || !apiResult.order) {
      throw new Error(apiResult.error || 'Failed to place reorder with API');
    }

    console.log(`Reorder placed successfully:`, apiResult.order);

    // Create new order record
    const { data: newOrder, error: newOrderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: profile.id,
        service_id: service.id,
        link: originalOrder.link,
        quantity: originalOrder.quantity,
        charge: charge,
        status: 'processing',
        api_order_id: apiResult.order.toString(),
      })
      .select()
      .single();

    if (newOrderError) {
      throw newOrderError;
    }

    // Deduct balance
    const newBalance = parseFloat(profile.balance) - charge;
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    await supabaseClient
      .from('transactions')
      .insert({
        user_id: profile.id,
        amount: -charge,
        type: 'order',
        reference_id: newOrder.id,
        description: `Reorder: ${service.name}`,
        balance_after: newBalance,
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: newOrder,
        message: 'Reorder placed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error processing reorder:', error);
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
