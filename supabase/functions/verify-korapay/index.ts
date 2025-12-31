import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get reference from query params or body
    const url = new URL(req.url);
    let reference = url.searchParams.get("reference");

    // If this is a webhook POST, parse the body
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body, null, 2));
      
      // Handle webhook notification
      if (body.event === "charge.success" && body.data?.reference) {
        reference = body.data.reference;
      }
    }

    if (!reference) {
      throw new Error("No reference provided");
    }

    console.log("Verifying Kora Pay transaction:", reference);

    // Verify with Kora Pay
    const korapaySecretKey = Deno.env.get("KORAPAY_SECRET_KEY");
    if (!korapaySecretKey) {
      throw new Error("Kora Pay secret key not configured");
    }

    const verifyResponse = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${korapaySecretKey}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();
    console.log("Kora Pay verification response:", JSON.stringify(verifyData, null, 2));

    if (!verifyResponse.ok || !verifyData.status) {
      throw new Error(verifyData.message || "Failed to verify payment");
    }

    const transaction = verifyData.data;

    if (transaction.status !== "success") {
      console.log("Transaction not successful:", transaction.status);
      
      // If this is a redirect request, redirect to failure page
      if (req.method === "GET") {
        return Response.redirect(`${url.origin}/payment/failed?reason=not_successful`, 302);
      }
      
      return new Response(
        JSON.stringify({ error: "Transaction not successful", status: transaction.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get user ID from metadata
    const userId = transaction.metadata?.user_id;
    const amount = transaction.metadata?.base_amount || transaction.amount;

    if (!userId) {
      throw new Error("No user ID in transaction metadata");
    }

    // Check if this transaction was already processed
    const { data: existingTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("reference_id", reference)
      .single();

    if (existingTx) {
      console.log("Transaction already processed:", reference);
      
      if (req.method === "GET") {
        return Response.redirect(`${url.origin}/payment/success?already_processed=true`, 302);
      }
      
      return new Response(
        JSON.stringify({ message: "Transaction already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get current balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Could not fetch user profile");
    }

    const newBalance = Number(profile.balance) + Number(amount);

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      throw new Error("Failed to update balance: " + updateError.message);
    }

    // Record transaction
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: amount,
      type: "deposit",
      description: `Deposit via Kora Pay (Ref: ${reference})`,
      balance_after: newBalance,
      reference_id: reference,
    });

    if (txError) {
      console.error("Failed to record transaction:", txError);
    }

    console.log("Payment verified and balance updated:", { userId, amount, newBalance });

    // If this is a redirect request (GET), redirect to success page
    if (req.method === "GET") {
      return Response.redirect(`${url.origin}/payment/success`, 302);
    }

    // For webhook POST, return success
    return new Response(
      JSON.stringify({ success: true, newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in verify-korapay:", error);
    
    // For GET requests, redirect to failure page
    if (req.method === "GET") {
      const url = new URL(req.url);
      return Response.redirect(`${url.origin}/payment/failed?reason=${encodeURIComponent(error.message)}`, 302);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
