import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// V4 OAuth token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  const clientId = Deno.env.get("FLUTTERWAVE_V4_CLIENT_ID");
  const clientSecret = Deno.env.get("FLUTTERWAVE_V4_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Flutterwave V4 client credentials not configured");
  }

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
  if (!response.ok || !data.access_token) {
    console.error("OAuth token error:", data);
    throw new Error("Failed to obtain Flutterwave access token");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 300) * 1000;
  return cachedToken!;
}

// AES-256-GCM encryption for card details
async function encryptAES(plainText: string, encryptionKey: string, nonce: string): Promise<string> {
  if (nonce.length !== 12) {
    throw new Error("Nonce must be exactly 12 characters long");
  }

  const decodedKeyBytes = Uint8Array.from(atob(encryptionKey), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    decodedKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = new TextEncoder().encode(nonce);
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );

  return btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
}

function generateNonce(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// Determine API base URL (sandbox vs production)
function getApiBaseUrl(): string {
  // Use production by default; set FLUTTERWAVE_V4_SANDBOX=true for sandbox
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid or expired token");

    const {
      amount,
      redirect_url,
      payment_type,
      currency: requestedCurrency,
      ngn_equivalent,
      // Card details (raw, will be encrypted server-side)
      card_number,
      expiry_month,
      expiry_year,
      cvv,
      // Mobile money details
      phone_number,
      phone_country_code,
      network,
    } = await req.json();

    console.log("V4 charge request:", { amount, payment_type, currency: requestedCurrency, userId: user.id });

    if (!amount || amount <= 0) throw new Error("Amount must be greater than zero");

    const chargeCurrency = requestedCurrency || "NGN";
    if (chargeCurrency === "NGN" && amount < 100) {
      throw new Error("Minimum deposit amount is ₦100");
    }

    const balanceAmount = chargeCurrency === "NGN" ? amount : (ngn_equivalent || amount);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw new Error("Could not fetch user profile");

    // Get OAuth access token
    const accessToken = await getAccessToken();
    const apiBaseUrl = getApiBaseUrl();

    // Generate unique reference
    const reference = `QF-FLW4-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Build the redirect URL for post-payment verification
    const verifyRedirectUrl = `${supabaseUrl}/functions/v1/verify-flutterwave?reference=${reference}&origin=${encodeURIComponent(redirect_url || '')}`;

    // Build payment method object based on type
    let paymentMethod: Record<string, any>;

    if (payment_type === "mobilemoney") {
      if (!phone_number || !phone_country_code || !network) {
        throw new Error("Mobile money requires phone_number, phone_country_code, and network");
      }
      paymentMethod = {
        type: "mobile_money",
        mobile_money: {
          country_code: phone_country_code,
          network: network,
          phone_number: phone_number,
        },
      };
    } else if (payment_type === "card") {
      if (!card_number || !expiry_month || !expiry_year || !cvv) {
        throw new Error("Card payment requires card_number, expiry_month, expiry_year, and cvv");
      }

      const encryptionKey = Deno.env.get("FLUTTERWAVE_V4_ENCRYPTION_KEY");
      if (!encryptionKey) throw new Error("Encryption key not configured");

      const nonce = generateNonce(12);
      const encrypted_card_number = await encryptAES(card_number, encryptionKey, nonce);
      const encrypted_expiry_month = await encryptAES(expiry_month, encryptionKey, nonce);
      const encrypted_expiry_year = await encryptAES(expiry_year, encryptionKey, nonce);
      const encrypted_cvv = await encryptAES(cvv, encryptionKey, nonce);

      paymentMethod = {
        type: "card",
        card: {
          nonce,
          encrypted_card_number,
          encrypted_expiry_month,
          encrypted_expiry_year,
          encrypted_cvv,
        },
      };
    } else if (payment_type === "bank_transfer") {
      paymentMethod = {
        type: "bank_transfer",
      };
    } else if (payment_type === "ussd") {
      paymentMethod = {
        type: "ussd",
        ussd: {
          account_bank: "044", // Default bank, can be overridden
        },
      };
    } else {
      throw new Error("Invalid payment_type. Use: card, mobilemoney, bank_transfer, or ussd");
    }

    // Build the orchestrator payload
    const chargePayload = {
      amount,
      currency: chargeCurrency,
      reference,
      redirect_url: verifyRedirectUrl,
      customer: {
        email: profile.email,
        name: {
          first: profile.full_name?.split(" ")[0] || profile.email.split("@")[0],
          last: profile.full_name?.split(" ").slice(1).join(" ") || "",
        },
      },
      payment_method: paymentMethod,
      meta: {
        user_id: user.id,
        base_amount: balanceAmount,
      },
    };

    console.log("Calling V4 orchestrator:", { reference, payment_type, currency: chargeCurrency });

    const chargeResponse = await fetch(`${apiBaseUrl}/orchestration/direct-charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Trace-Id": reference,
        "X-Idempotency-Key": reference,
      },
      body: JSON.stringify(chargePayload),
    });

    const chargeData = await chargeResponse.json();
    console.log("V4 orchestrator response:", JSON.stringify(chargeData));

    if (!chargeResponse.ok || chargeData.status !== "success") {
      console.error("V4 charge error:", chargeData);
      const errorMsg = chargeData.error?.message || chargeData.message || "Failed to create charge";
      throw new Error(errorMsg);
    }

    // Return the charge response to frontend for handling
    const responseData: Record<string, any> = {
      charge_id: chargeData.data.id,
      reference,
      status: chargeData.data.status,
      amount,
    };

    // Handle next_action from the response
    const nextAction = chargeData.data.next_action;
    if (nextAction) {
      responseData.next_action = nextAction;

      // For redirect flows, provide the URL directly
      if (nextAction.type === "redirect_url" && nextAction.redirect_url?.url) {
        responseData.redirect_url = nextAction.redirect_url.url;
      }

      // For payment instructions (mobile money, USSD)
      if (nextAction.type === "payment_instruction" && nextAction.payment_instruction?.note) {
        responseData.payment_instruction = nextAction.payment_instruction.note;
      }

      // For bank transfer
      if (nextAction.type === "requires_bank_transfer" && nextAction.requires_bank_transfer) {
        responseData.bank_transfer = nextAction.requires_bank_transfer;
      }
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in initialize-flutterwave V4:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
