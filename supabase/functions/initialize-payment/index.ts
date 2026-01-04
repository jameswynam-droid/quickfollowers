import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to verify the JWT and get user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, redirect_url } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate Paystack fee (local card: 1.5% + ₦100, capped at ₦2,000)
    // If ≤ ₦2,500: only 1.5% (₦100 waived)
    // If > ₦2,500: ₦100 + 1.5%, max ₦2,000 total fee
    const baseAmount = parseFloat(amount);
    const percentageFee = baseAmount * 0.015; // 1.5%
    const fixedFee = baseAmount <= 2500 ? 0 : 100; // Waive ₦100 if ₦2,500 or less
    const uncappedFee = percentageFee + fixedFee;
    const totalFee = Math.min(uncappedFee, 2000); // Cap at ₦2,000
    const totalAmount = baseAmount + totalFee;

    console.log('Payment calculation:', {
      baseAmount,
      percentageFee,
      fixedFee,
      totalFee,
      totalAmount,
      redirect_url
    });

    // Get user profile for email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the redirect_url from frontend or default to production domain
    const callbackBaseUrl = redirect_url || 'https://quickfollowers.online';

    // Initialize Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        amount: Math.round(totalAmount * 100), // Convert to kobo (smallest currency unit)
        currency: 'NGN',
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-payment`,
        metadata: {
          user_id: profile.id,
          base_amount: baseAmount,
          fee_amount: totalFee,
          redirect_url: callbackBaseUrl,
          custom_fields: [
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: profile.id
            },
            {
              display_name: "Base Amount",
              variable_name: "base_amount",
              value: baseAmount
            }
          ]
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok) {
      console.error('Paystack initialization error:', paystackData);
      return new Response(
        JSON.stringify({ error: 'Payment initialization failed', details: paystackData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment initialized successfully:', {
      reference: paystackData.data.reference,
      amount: totalAmount,
      userId: profile.id,
    });

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        totalAmount,
        fee: totalFee,
        baseAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in initialize-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
