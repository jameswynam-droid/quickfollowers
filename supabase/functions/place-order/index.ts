import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  service_id: string;
  link: string;
  quantity: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { service_id, link, quantity }: OrderRequest = await req.json();

    // Validate input
    if (!service_id || !link || !quantity) {
      throw new Error('Missing required fields');
    }

    // Get service details including provider
    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      throw new Error('Service not found');
    }

    // Extract provider and actual service ID from composite ID
    const provider = service.provider;
    const actualServiceId = service_id.split('-')[1];

    // Calculate charge
    const charge = (service.rate * quantity).toFixed(2);

    // Check user balance (RLS ensures this is the current user)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, balance')
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    if (parseFloat(profile.balance) < parseFloat(charge)) {
      throw new Error('Insufficient balance');
    }

    // Determine API endpoint and key based on provider
    let apiUrl: string;
    let apiKey: string | undefined;

    if (provider === 'owlet') {
      apiUrl = 'https://therealowlet.com/api/v2';
      apiKey = Deno.env.get('OWLET_API_KEY');
    } else if (provider === 'followspanel') {
      apiUrl = 'https://followspanel.com/api/v2';
      apiKey = Deno.env.get('FOLLOWSPANEL_API_KEY');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    console.log(`Placing order with ${provider} API...`);
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        action: 'add',
        service: parseInt(actualServiceId),
        link: link,
        quantity: quantity,
      }),
    });

    const apiResult = await apiResponse.json();
    
    if (!apiResponse.ok || !apiResult.order) {
      throw new Error(apiResult.error || 'Failed to place order with API');
    }

    console.log(`Order placed successfully with ${provider} API:`, apiResult.order);

    // Create order record
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: profile.id,
        service_id: service_id,
        link: link,
        quantity: quantity,
        charge: parseFloat(charge),
        status: 'processing',
        api_order_id: apiResult.order.toString(),
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Deduct balance
    const newBalance = parseFloat(profile.balance) - parseFloat(charge);
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: profile.id,
        amount: -parseFloat(charge),
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
