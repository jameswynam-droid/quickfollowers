import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovalRequest {
  payment_id: string;
  approved: boolean;
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

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (rolesError || !roles) {
      throw new Error('Access denied: Admin only');
    }

    const { payment_id, approved }: ApprovalRequest = await req.json();

    if (!payment_id || typeof approved !== 'boolean') {
      throw new Error('Missing required fields');
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*, profiles!inner(balance)')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new Error('Payment already processed');
    }

    const newStatus = approved ? 'approved' : 'rejected';

    // Update payment status
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    if (updateError) {
      throw updateError;
    }

    // If approved, update user balance
    if (approved) {
      const currentBalance = parseFloat(payment.profiles.balance);
      const newBalance = currentBalance + parseFloat(payment.amount);

      const { error: balanceError } = await supabaseClient
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', payment.user_id);

      if (balanceError) {
        throw balanceError;
      }

      // Create transaction record
      const { error: txError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: payment.user_id,
          amount: parseFloat(payment.amount),
          type: 'deposit',
          reference_id: payment_id,
          description: 'Bank transfer deposit',
          balance_after: newBalance,
        });

      if (txError) {
        console.error('Error creating transaction:', txError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Payment ${newStatus}`,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error approving payment:', error);
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
