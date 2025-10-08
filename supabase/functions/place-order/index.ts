import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  service_id: number;
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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { service_id, link, quantity }: OrderRequest = await req.json();

    // Validate input
    if (!service_id || !link || !quantity) {
      throw new Error('Missing required fields');
    }

    // Get service details
    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      throw new Error('Service not found');
    }

    // Calculate charge
    const charge = (service.rate * quantity).toFixed(2);

    // Check user balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    if (parseFloat(profile.balance) < parseFloat(charge)) {
      throw new Error('Insufficient balance');
    }

    // Place order with The Owlet API
    const apiKey = Deno.env.get('OWLET_API_KEY');
    console.log('Placing order with The Owlet API...');
    
    const apiResponse = await fetch('https://therealowlet.com/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        action: 'add',
        service: service_id,
        link: link,
        quantity: quantity,
      }),
    });

    const apiResult = await apiResponse.json();
    
    if (!apiResponse.ok || !apiResult.order) {
      throw new Error(apiResult.error || 'Failed to place order with API');
    }

    console.log('Order placed successfully with API:', apiResult.order);

    // Create order record
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user.id,
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
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
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
