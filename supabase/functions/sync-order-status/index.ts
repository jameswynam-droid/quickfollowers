import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderStatusResponse {
  charge: string;
  start_count: string;
  status: string;
  remains: string;
  currency: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all non-completed orders with charge and user_id for potential refunds
    const { data: pendingOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, api_order_id, service_id, status, charge, user_id, quantity')
      .in('status', ['pending', 'processing']);

    if (ordersError) {
      throw ordersError;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('No pending orders to sync');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending orders', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pendingOrders.length} pending orders to sync`);

    const owletApiKey = Deno.env.get('OWLET_API_KEY');
    const followspanelApiKey = Deno.env.get('FOLLOWSPANEL_API_KEY');

    let updatedCount = 0;
    let refundedCount = 0;

    for (const order of pendingOrders) {
      if (!order.api_order_id) {
        console.log(`Order ${order.id} has no API order ID, skipping`);
        continue;
      }

      // Determine provider from service_id
      const provider = order.service_id.startsWith('followspanel-') ? 'followspanel' : 'owlet';
      
      let apiUrl: string;
      let apiKey: string | undefined;

      if (provider === 'owlet') {
        apiUrl = 'https://therealowlet.com/api/v2';
        apiKey = owletApiKey;
      } else {
        apiUrl = 'https://followspanel.com/api/v2';
        apiKey = followspanelApiKey;
      }

      if (!apiKey) {
        console.log(`No API key for provider ${provider}, skipping order ${order.id}`);
        continue;
      }

      try {
        console.log(`Checking status for order ${order.id} (API: ${order.api_order_id}) from ${provider}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: apiKey,
            action: 'status',
            order: parseInt(order.api_order_id),
          }),
        });

        if (!response.ok) {
          console.error(`API request failed for order ${order.id}: ${response.statusText}`);
          continue;
        }

        const result = await response.json();
        console.log(`Order ${order.id} API response:`, result);
        
        // Check if response is an error object
        if (result && typeof result === 'object' && 'error' in result) {
          console.error(`API error for order ${order.id}:`, result.error);
          continue;
        }

        // Map API status to our status enum
        let newStatus: string;
        const apiStatus = result.status?.toLowerCase();
        
        if (apiStatus === 'completed') {
          newStatus = 'completed';
        } else if (apiStatus === 'canceled' || apiStatus === 'cancelled') {
          newStatus = 'cancelled';
        } else if (apiStatus === 'partial' || apiStatus === 'refunded') {
          newStatus = 'completed'; // Treat partial as completed
        } else if (apiStatus === 'in progress' || apiStatus === 'inprogress' || apiStatus === 'processing') {
          newStatus = 'processing';
        } else if (apiStatus === 'pending') {
          newStatus = 'pending';
        } else if (apiStatus === 'failed' || apiStatus === 'error') {
          newStatus = 'failed';
        } else {
          console.log(`Unknown status "${result.status}" for order ${order.id}, keeping as ${order.status}`);
          continue;
        }

        // Update order if status changed
        if (newStatus !== order.status) {
          const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };

          // Add start_count and remains if available
          if (result.start_count) {
            updateData.start_count = parseInt(result.start_count);
          }
          if (result.remains) {
            updateData.remains = parseInt(result.remains);
          }

          const { error: updateError } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', order.id);

          if (updateError) {
            console.error(`Error updating order ${order.id}:`, updateError);
          } else {
            console.log(`Order ${order.id} status updated: ${order.status} -> ${newStatus}`);
            updatedCount++;

            // Process refund for cancelled or failed orders
            if (newStatus === 'cancelled' || newStatus === 'failed') {
              await processRefund(supabaseClient, order);
              refundedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error checking status for order ${order.id}:`, error);
      }
    }

    console.log(`Order status sync complete. Updated ${updatedCount} orders, refunded ${refundedCount}.`);

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
    
    if (isNaN(refundAmount) || refundAmount <= 0) {
      console.log(`Invalid refund amount for order ${order.id}: ${order.charge}`);
      return;
    }

    console.log(`Processing refund of ${refundAmount} for order ${order.id} to user ${order.user_id}`);

    // Get current user balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('balance')
      .eq('id', order.user_id)
      .single();

    if (profileError) {
      console.error(`Error fetching profile for refund:`, profileError);
      return;
    }

    const currentBalance = parseFloat(profile.balance) || 0;
    const newBalance = currentBalance + refundAmount;

    // Update user balance
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', order.user_id);

    if (updateError) {
      console.error(`Error updating balance for refund:`, updateError);
      return;
    }

    // Create refund transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: order.user_id,
        type: 'refund',
        amount: refundAmount,
        balance_after: newBalance,
        description: `Refund for cancelled order #${order.id.slice(0, 8)}`,
        reference_id: order.id,
      });

    if (transactionError) {
      console.error(`Error creating refund transaction:`, transactionError);
      return;
    }

    console.log(`Refund of ${refundAmount} processed successfully for order ${order.id}. New balance: ${newBalance}`);
  } catch (error) {
    console.error(`Error processing refund for order ${order.id}:`, error);
  }
}
