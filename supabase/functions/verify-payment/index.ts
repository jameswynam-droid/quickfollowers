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

    // DUPLICATE PREVENTION: Check if this reference was already processed
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('reference_id', reference)
      .eq('type', 'deposit')
      .maybeSingle();

    if (existingTx) {
      console.log('Payment already processed for reference:', reference);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/payment/success?reference=${encodeURIComponent(reference)}`,
        },
      });
    }

    console.log('Processing payment for user:', userId, 'Amount:', baseAmount);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/dashboard?payment=failed&error=profile_not_found`,
        },
      });
    }

    const newBalance = Number(profile.balance) + Number(baseAmount);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error('Balance update error:', updateError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/dashboard?payment=failed&error=balance_update_failed`,
        },
      });
    }

    // Create transaction record with payment method and reference
    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: baseAmount,
        balance_after: newBalance,
        description: `Paystack deposit (Paid: ₦${totalPaid.toFixed(2)})`,
        reference_id: reference,
        payment_method: 'paystack',
      });

    if (transactionError) {
      console.error('Transaction record error:', transactionError);
    }

    console.log('Payment verified and balance updated:', {
      userId, baseAmount, totalPaid, newBalance, reference,
    });

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
