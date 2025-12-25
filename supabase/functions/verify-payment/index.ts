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
    
    // Get redirect URL from metadata or use production domain
    const redirectUrl = transaction.metadata?.redirect_url || 'https://quickfollowers.online';
    console.log('Using redirect URL:', redirectUrl);

    if (transaction.status !== 'success') {
      console.log('Payment not successful:', transaction.status);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}/dashboard?payment=failed`,
        },
      });
    }

    // Use service role key to update database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userId = transaction.metadata.user_id;
    const baseAmount = transaction.metadata.base_amount || (transaction.amount / 100); // Use base amount from metadata
    const totalPaid = transaction.amount / 100; // Convert from kobo to naira

    console.log('Processing payment for user:', userId, 'Amount:', baseAmount);

    // Get current balance
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

    console.log('Current balance:', profile.balance);

    // Credit the base amount to user (not including fees)
    const newBalance = Number(profile.balance) + Number(baseAmount);

    console.log('New balance will be:', newBalance);

    // Update user balance
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

    console.log('Balance updated successfully');

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: baseAmount,
        balance_after: newBalance,
        description: `Paystack deposit - ${reference} (Paid: ₦${totalPaid.toFixed(2)})`,
        reference_id: null,
      });

    if (transactionError) {
      console.error('Transaction record error:', transactionError);
    }

    console.log('Payment verified and balance updated:', {
      userId,
      baseAmount,
      totalPaid,
      newBalance,
      reference,
    });

    console.log('Redirecting to:', `${redirectUrl}/dashboard?payment=success`);

    // Redirect to dashboard with success message
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${redirectUrl}/dashboard?payment=success`,
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
