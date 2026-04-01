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

    // Group orders by provider for batch status checks
    const owletOrders = pendingOrders.filter(o => o.api_order_id && !o.service_id.startsWith('smmfollows-'));
    const smmfollowsOrders = pendingOrders.filter(o => o.api_order_id && o.service_id.startsWith('smmfollows-'));

    let updatedCount = 0;
    let refundedCount = 0;

    // Batch check owlet orders (up to 100 at a time using multiorder status)
    if (owletApiKey && owletOrders.length > 0) {
      const result = await batchCheckStatus(
        'https://therealowlet.com/api/v2',
        owletApiKey,
        owletOrders,
        supabaseClient
      );
      updatedCount += result.updated;
      refundedCount += result.refunded;
    }

    // Batch check smmfollows orders
    if (smmfollowsApiKey && smmfollowsOrders.length > 0) {
      const result = await batchCheckStatus(
        'https://smmfollows.com/api/v2',
        smmfollowsApiKey,
        smmfollowsOrders,
        supabaseClient
      );
      updatedCount += result.updated;
      refundedCount += result.refunded;
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

async function batchCheckStatus(
  apiUrl: string,
  apiKey: string,
  orders: any[],
  supabaseClient: any
) {
  let updated = 0;
  let refunded = 0;

  // Try batch/multi-order status first (1 API call for up to 100 orders)
  const BATCH_SIZE = 100;
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    const orderIds = batch.map(o => parseInt(o.api_order_id)).join(',');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: apiKey,
          action: 'status',
          orders: orderIds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Multi-order response: { "order_id": { status, start_count, remains }, ... }
        if (result && typeof result === 'object' && !('error' in result) && !('status' in result)) {
          for (const order of batch) {
            const statusData = result[order.api_order_id];
            if (statusData) {
              const r = await processOrderStatus(supabaseClient, order, statusData);
              updated += r.updated;
              refunded += r.refunded;
            }
          }
          continue; // Batch succeeded, skip individual checks
        }
      }
    } catch (e) {
      console.log('Batch status check failed, falling back to individual:', e);
    }

    // Fallback: check individually
    for (const order of batch) {
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

        const r = await processOrderStatus(supabaseClient, order, result);
        updated += r.updated;
        refunded += r.refunded;
      } catch (error) {
        console.error(`Error checking status for order ${order.id}:`, error);
      }
    }
  }

  return { updated, refunded };
}

function mapApiStatus(apiStatus: string): string | null {
  const s = apiStatus?.toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'partial') return 'partial';
  if (s === 'in progress' || s === 'inprogress' || s === 'processing') return 'processing';
  if (s === 'pending') return 'pending';
  if (s === 'refunded') return 'cancelled';
  if (s === 'failed' || s === 'error') return 'failed';
  return null;
}

async function processOrderStatus(supabaseClient: any, order: any, result: any) {
  let updated = 0;
  let refunded = 0;

  const newStatus = mapApiStatus(result.status);
  if (!newStatus) return { updated: 0, refunded: 0 };

  const updateData: any = { updated_at: new Date().toISOString() };
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

    if (!updateError) {
      updated = 1;
      if (newStatus !== order.status) {
        if (newStatus === 'cancelled' || newStatus === 'failed') {
          // Full refund for cancelled/failed orders
          await processRefund(supabaseClient, order, parseFloat(order.charge));
          refunded = 1;
        } else if (newStatus === 'partial') {
          // Partial refund based on remains
          const remains = result.remains !== undefined ? parseInt(result.remains) : 0;
          if (remains > 0) {
            const isPerOne = order.quantity === 1;
            const refundAmount = isPerOne
              ? 0 // Per-one pricing with partial doesn't make sense
              : (remains / order.quantity) * parseFloat(order.charge);
            if (refundAmount > 0) {
              await processRefund(supabaseClient, order, refundAmount);
              refunded = 1;
            }
          }
        }
      }
    }
  }

  return { updated, refunded };
}

async function processRefund(supabaseClient: any, order: any, refundAmount: number) {
  try {
    if (isNaN(refundAmount) || refundAmount <= 0) return;

    // Check for existing refund using both possible reference_id values
    const refRefId = order.api_order_id || order.id;
    const { data: existingRefunds } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('type', 'refund')
      .or(`reference_id.eq.${order.id},reference_id.eq.${refRefId}`);

    if (existingRefunds && existingRefunds.length > 0) return;

    const { data: newTransaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: order.user_id,
        type: 'refund',
        amount: refundAmount,
        balance_after: 0,
        description: `Refund for order #${order.api_order_id || order.id}`,
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
  } catch (error) {
    console.error(`Error processing refund for order ${order.id}:`, error);
  }
}
