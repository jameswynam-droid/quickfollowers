import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const txRef = url.searchParams.get("tx_ref");
    const transactionId = url.searchParams.get("transaction_id");
    const status = url.searchParams.get("status");
    const origin = url.searchParams.get("origin") || "https://quickfollowers.online";

    console.log("Flutterwave callback:", { txRef, transactionId, status });

    // Handle cancelled/failed payments before API verification
    if (status === "cancelled") {
      console.log("Payment cancelled by user");
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=cancelled`,
        },
      });
    }

    if (!transactionId) {
      console.log("No transaction ID - payment may have failed");
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=no_transaction`,
        },
      });
    }

    // Verify transaction with Flutterwave API
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flutterwaveSecretKey) {
      throw new Error("Flutterwave secret key not configured");
    }

    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyData = await verifyResponse.json();
    console.log("Flutterwave verification response:", verifyData);

    if (!verifyResponse.ok || verifyData.status !== "success") {
      console.error("Flutterwave verification error:", verifyData);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=verification_failed`,
        },
      });
    }

    const transaction = verifyData.data;

    // Check if transaction was successful
    if (transaction.status !== "successful") {
      console.log("Payment not successful:", transaction.status);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=${transaction.status}`,
        },
      });
    }

    // Verify tx_ref matches
    if (transaction.tx_ref !== txRef) {
      console.error("Transaction reference mismatch:", { expected: txRef, got: transaction.tx_ref });
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=reference_mismatch`,
        },
      });
    }

    // Use service role key to update database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userId = transaction.meta?.user_id;
    const baseAmount = transaction.meta?.base_amount || transaction.amount;

    if (!userId) {
      console.error("No user_id in transaction metadata");
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=no_user_id`,
        },
      });
    }

    console.log("Processing payment for user:", userId, "Amount:", baseAmount);

    // Get current balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/dashboard?payment=failed&error=profile_not_found`,
        },
      });
    }

    console.log("Current balance:", profile.balance);

    // Credit the base amount to user
    const newBalance = Number(profile.balance) + Number(baseAmount);

    console.log("New balance will be:", newBalance);

    // Update user balance
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      console.error("Balance update error:", updateError);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/dashboard?payment=failed&error=balance_update_failed`,
        },
      });
    }

    console.log("Balance updated successfully");

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "deposit",
        amount: baseAmount,
        balance_after: newBalance,
        description: `Flutterwave deposit - ${txRef}`,
        reference_id: null,
      });

    if (transactionError) {
      console.error("Transaction record error:", transactionError);
    }

    console.log("Payment verified and balance updated:", {
      userId,
      baseAmount,
      newBalance,
      txRef,
      transactionId,
    });

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `${origin}/payment/success?reference=${encodeURIComponent(txRef || "")}`,
      },
    });
  } catch (error) {
    console.error("Error in verify-flutterwave:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
