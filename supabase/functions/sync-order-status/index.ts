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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: pendingOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, api_order_id, service_id, status, charge, user_id, quantity')
      .in('status', ['pending', 'processing', 'partial']);

    if (ordersError) throw ordersError;

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending orders', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pendingOrders.length} pending orders to sync`);

    const owletApiKey = Deno.env.get('OWLET_API_KEY');
    const smmfollowsApiKey = Deno.env.get('SMMFOLLOWS_API_KEY');

    let updatedCount = 0;
    let refundedCount = 0;

    for (const order of pendingOrders) {
      if (!order.api_order_id) continue;

      const provider = order.service_id.startsWith('smmfollows-') ? 'smmfollows' : 'owlet';
      
      let apiUrl: string;
      let apiKey: string | undefined;

      if (provider === 'owlet') {
        apiUrl = 'https://therealowlet.com/api/v2';
        apiKey = owletApiKey;
      } else {
        apiUrl = 'https://smmfollows.com/api/v2';
        apiKey = smmfollowsApiKey;
      }

      if (!apiKey) continue;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: apiKey,
            action: 'status',
            order: parseInt(order.api_order_id),
          }),
        });

        if (!response.ok) continue;

        const result = await response.json();
        
        if (result && typeof result === 'object' && 'error' in result) continue;

        // Use exact API status mapped to our DB enum
        let newStatus: string;
        const apiStatus = result.status?.toLowerCase();
        
        if (apiStatus === 'completed') {
          newStatus = 'completed';
        } else if (apiStatus === 'canceled' || apiStatus === 'cancelled') {
          newStatus = 'cancelled';
        } else if (apiStatus === 'partial') {
          newStatus = 'partial';
        } else if (apiStatus === 'in progress' || apiStatus === 'inprogress' || apiStatus === 'processing') {
          newStatus = 'processing';
        } else if (apiStatus === 'pending') {
          newStatus = 'pending';
        } else if (apiStatus === 'refunded') {
          newStatus = 'cancelled'; // Treat refunded as cancelled for refund processing
        } else if (apiStatus === 'failed' || apiStatus === 'error') {
          newStatus = 'failed';
        } else {
          console.log(`Unknown status "${result.status}" for order ${order.id}`);
          continue;
        }

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        let hasChanges = false;

        if (newStatus !== order.status) {
          updateData.status = newStatus;
          hasChanges = true;
        }

        if (result.start_count !== undefined && result.start_count !== null) {
          updateData.start_count = parseInt(result.start_count);
          hasChanges = true;
        }
        if (result.remains !== undefined && result.remains !== null) {
          updateData.remains = parseInt(result.remains);
          hasChanges = true;
        }

        if (hasChanges) {
          const { error: updateError } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', order.id);

          if (updateError) {
            console.error(`Error updating order ${order.id}:`, updateError);
          } else {
            console.log(`Order ${order.id} updated: status=${newStatus}, remains=${result.remains}, start_count=${result.start_count}`);
            updatedCount++;

            if (newStatus !== order.status && (newStatus === 'cancelled' || newStatus === 'failed')) {
              await processRefund(supabaseClient, order);
              refundedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error checking status for order ${order.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${pendingOrders.length} orders`,
        updated: updatedCount,
        refunded: refundedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error syncing order status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function processRefund(supabaseClient: any, order: any) {
  try {
    const refundAmount = parseFloat(order.charge);
    if (isNaN(refundAmount) || refundAmount <= 0) return;

    const { data: existingRefunds } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('reference_id', order.id)
      .eq('type', 'refund');

    if (existingRefunds && existingRefunds.length > 0) return;

    console.log(`Processing refund of ${refundAmount} for order ${order.id}`);

    const { data: newTransaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: order.user_id,
        type: 'refund',
        amount: refundAmount,
        balance_after: 0,
        description: `Refund for cancelled order`,
        reference_id: order.api_order_id || order.id,
      })
      .select('id')
      .single();

    if (transactionError) return;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('balance')
      .eq('id', order.user_id)
      .single();

    if (!profile) return;

    const newBalance = parseFloat(profile.balance) + refundAmount;

    await supabaseClient
      .from('profiles')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', order.user_id);

    await supabaseClient
      .from('transactions')
      .update({ balance_after: newBalance })
      .eq('id', newTransaction.id);

    console.log(`Refund processed for order ${order.id}. New balance: ${newBalance}`);
  } catch (error) {
    console.error(`Error processing refund for order ${order.id}:`, error);
  }
}
