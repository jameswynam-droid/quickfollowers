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

    if (status === "cancelled") {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=cancelled`,
        },
      });
    }

    if (!transactionId) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=no_transaction`,
        },
      });
    }

    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flutterwaveSecretKey) throw new Error("Flutterwave secret key not configured");

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

    if (!verifyResponse.ok || verifyData.status !== "success") {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=verification_failed`,
        },
      });
    }

    const transaction = verifyData.data;

    if (transaction.status !== "successful") {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=${transaction.status}`,
        },
      });
    }

    if (transaction.tx_ref !== txRef) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=reference_mismatch`,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userId = transaction.meta?.user_id;
    const baseAmount = transaction.meta?.base_amount || transaction.amount;

    if (!userId) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=no_user_id`,
        },
      });
    }

    // Use atomic process_deposit to prevent duplicates
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("process_deposit", {
      p_reference_id: txRef,
      p_user_id: userId,
      p_amount: baseAmount,
      p_payment_method: "flutterwave",
      p_description: `Flutterwave deposit`,
    });

    if (rpcError) {
      console.error("process_deposit RPC error:", rpcError);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${origin}/dashboard?payment=failed&error=balance_update_failed`,
        },
      });
    }

    if (result && !result.success) {
      console.log("Payment already processed for tx_ref:", txRef);
    } else {
      console.log("Payment processed successfully for tx_ref:", txRef, "result:", result);
    }

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
