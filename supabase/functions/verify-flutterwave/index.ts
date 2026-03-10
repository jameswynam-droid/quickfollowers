import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30000) return cachedToken;

  const clientId = Deno.env.get("FLUTTERWAVE_V4_CLIENT_ID");
  const clientSecret = Deno.env.get("FLUTTERWAVE_V4_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Flutterwave V4 client credentials not configured");

  const response = await fetch(
    "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    }
  );

  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Failed to obtain access token");

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 300) * 1000;
  return cachedToken!;
}

function getApiBaseUrl(): string {
  const isSandbox = Deno.env.get("FLUTTERWAVE_V4_SANDBOX") === "true";
  return isSandbox
    ? "https://developersandbox-api.flutterwave.com"
    : "https://api.flutterwave.com";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    const chargeId = url.searchParams.get("charge_id");
    const origin = url.searchParams.get("origin") || "https://quickfollowers.online";

    console.log("V4 verify callback:", { reference, chargeId });

    // Two modes: redirect callback (GET with query params) or direct API call (POST with body)
    let verifyChargeId = chargeId;
    let verifyReference = reference;
    let isDirectCall = false;

    if (req.method === "POST") {
      // Direct API call from frontend for polling
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) throw new Error("Invalid or expired token");

      const body = await req.json();
      verifyChargeId = body.charge_id;
      verifyReference = body.reference;
      isDirectCall = true;
    }

    if (!verifyChargeId && !verifyReference) {
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ error: "charge_id or reference is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/failed?reason=no_reference` },
      });
    }

    const accessToken = await getAccessToken();
    const apiBaseUrl = getApiBaseUrl();

    // Verify the charge - try by charge_id first, then by reference
    let verifyUrl: string;
    if (verifyChargeId) {
      verifyUrl = `${apiBaseUrl}/charges/${verifyChargeId}`;
    } else {
      // V4 may support query by reference
      verifyUrl = `${apiBaseUrl}/charges?reference=${verifyReference}`;
    }

    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const verifyData = await verifyResponse.json();
    console.log("V4 verify response:", JSON.stringify(verifyData));

    if (!verifyResponse.ok || verifyData.status !== "success") {
      const failReason = "verification_failed";
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "failed", reason: failReason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/failed?reference=${encodeURIComponent(verifyReference || "")}&reason=${failReason}` },
      });
    }

    const charge = verifyData.data;
    const chargeStatus = charge.status;

    // If still pending, return status for polling
    if (chargeStatus === "pending") {
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "pending", charge_id: charge.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      // For redirect callbacks, pending means payment hasn't completed yet
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/failed?reference=${encodeURIComponent(verifyReference || "")}&reason=pending` },
      });
    }

    if (chargeStatus !== "succeeded") {
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "failed", reason: chargeStatus }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/failed?reference=${encodeURIComponent(verifyReference || "")}&reason=${chargeStatus}` },
      });
    }

    // Payment succeeded - credit the user's balance
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userId = charge.meta?.user_id;
    const baseAmount = charge.meta?.base_amount || charge.amount;
    const txRef = charge.reference || verifyReference;

    if (!userId) {
      const failReason = "no_user_id";
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "failed", reason: failReason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/failed?reference=${encodeURIComponent(txRef || "")}&reason=${failReason}` },
      });
    }

    // Idempotency: check if already processed
    const { data: existingTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("reference_id", txRef)
      .eq("type", "deposit")
      .maybeSingle();

    if (existingTx) {
      console.log("Payment already processed for reference:", txRef);
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "success", already_processed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/payment/success?reference=${encodeURIComponent(txRef || "")}` },
      });
    }

    // Credit balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "failed", reason: "profile_not_found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/dashboard?payment=failed&error=profile_not_found` },
      });
    }

    const newBalance = Number(profile.balance) + Number(baseAmount);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateError) {
      if (isDirectCall) {
        return new Response(
          JSON.stringify({ status: "failed", reason: "balance_update_failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}/dashboard?payment=failed&error=balance_update_failed` },
      });
    }

    // Create transaction record
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "deposit",
        amount: baseAmount,
        balance_after: newBalance,
        description: "Flutterwave V4 deposit",
        reference_id: txRef,
        payment_method: "flutterwave",
      });

    if (transactionError) {
      console.error("Transaction record error:", transactionError);
    }

    if (isDirectCall) {
      return new Response(
        JSON.stringify({ status: "success", new_balance: newBalance }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/payment/success?reference=${encodeURIComponent(txRef || "")}` },
    });
  } catch (error) {
    console.error("Error in verify-flutterwave V4:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
