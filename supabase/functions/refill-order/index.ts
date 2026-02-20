import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (!order_id) {
      throw new Error('Order ID is required');
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, services(name, provider)')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.api_order_id) {
      throw new Error('This order cannot be refilled (no API order ID)');
    }

    // Get provider API details
    const provider = order.services?.provider || (order.service_id.startsWith('smmfollows-') ? 'smmfollows' : 'owlet');
    
    let apiUrl: string;
    let apiKey: string | undefined;

    if (provider === 'owlet') {
      apiUrl = 'https://therealowlet.com/api/v2';
      apiKey = Deno.env.get('OWLET_API_KEY');
    } else if (provider === 'smmfollows') {
      apiUrl = 'https://smmfollows.io/api/v2';
      apiKey = Deno.env.get('SMMFOLLOWS_API_KEY');
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    console.log(`Requesting refill for order ${order.api_order_id} from ${provider}`);

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        action: 'refill',
        order: parseInt(order.api_order_id),
      }),
    });

    const apiResult = await apiResponse.json();

    if (apiResult.error) {
      throw new Error(apiResult.error);
    }

    console.log(`Refill response:`, apiResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Refill request submitted successfully',
        refill_id: apiResult.refill || null,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error processing refill:', error);
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
