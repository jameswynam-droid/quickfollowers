import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
      return new Response(
        JSON.stringify({ error: 'No reference provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying payment with reference:', reference);

    // Verify transaction with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('Paystack verification error:', paystackData);
      return new Response(
        JSON.stringify({ error: 'Payment verification failed', details: paystackData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transaction = paystackData.data;
    
    const redirectUrl = transaction.metadata?.redirect_url || 'https://quickfollowers.online';

    if (transaction.status !== 'success') {
      console.log('Payment not successful:', transaction.status);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/payment/failed?reference=${encodeURIComponent(reference)}`,
        },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userId = transaction.metadata.user_id;
    const baseAmount = transaction.metadata.base_amount || (transaction.amount / 100);
    const totalPaid = transaction.amount / 100;

    // Use atomic process_deposit to prevent duplicates
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("process_deposit", {
      p_reference_id: reference,
      p_user_id: userId,
      p_amount: baseAmount,
      p_payment_method: "paystack",
      p_description: `Paystack deposit (Paid: ₦${totalPaid.toFixed(2)})`,
    });

    if (rpcError) {
      console.error('process_deposit RPC error:', rpcError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/dashboard?payment=failed&error=balance_update_failed`,
        },
      });
    }

    if (result && !result.success) {
      console.log('Payment already processed for reference:', reference);
    } else {
      console.log('Payment verified and balance updated:', {
        userId, baseAmount, totalPaid, reference,
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${redirectUrl}/payment/success?reference=${encodeURIComponent(reference)}`,
      },
    });

  } catch (error) {
    console.error('Error in verify-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
