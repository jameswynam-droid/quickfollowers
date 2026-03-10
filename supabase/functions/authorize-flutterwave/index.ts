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

// AES-256-GCM encryption for PIN
async function encryptAES(plainText: string, encryptionKey: string, nonce: string): Promise<string> {
  const decodedKeyBytes = Uint8Array.from(atob(encryptionKey), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", decodedKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new TextEncoder().encode(nonce);
  const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));
  return btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
}

function generateNonce(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
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

    const { charge_id, authorization_type, pin, otp, avs } = await req.json();
    if (!charge_id) throw new Error("charge_id is required");
    if (!authorization_type) throw new Error("authorization_type is required");

    const accessToken = await getAccessToken();
    const apiBaseUrl = getApiBaseUrl();

    let authorizationPayload: Record<string, any>;

    if (authorization_type === "pin") {
      if (!pin) throw new Error("PIN is required");
      const encryptionKey = Deno.env.get("FLUTTERWAVE_V4_ENCRYPTION_KEY");
      if (!encryptionKey) throw new Error("Encryption key not configured");
      const nonce = generateNonce(12);
      const encryptedPin = await encryptAES(pin, encryptionKey, nonce);
      authorizationPayload = {
        authorization: {
          type: "pin",
          pin: {
            nonce,
            encrypted_pin: encryptedPin,
          },
        },
      };
    } else if (authorization_type === "otp") {
      if (!otp) throw new Error("OTP code is required");
      authorizationPayload = {
        authorization: {
          type: "otp",
          otp: { code: otp },
        },
      };
    } else if (authorization_type === "avs") {
      if (!avs) throw new Error("Address details are required");
      authorizationPayload = {
        authorization: {
          type: "avs",
          avs: { address: avs },
        },
      };
    } else {
      throw new Error("Invalid authorization_type. Use: pin, otp, or avs");
    }

    console.log("Authorizing charge:", { charge_id, authorization_type });

    const authorizeResponse = await fetch(`${apiBaseUrl}/charges/${charge_id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Trace-Id": `auth-${charge_id}-${Date.now()}`,
      },
      body: JSON.stringify(authorizationPayload),
    });

    const authorizeData = await authorizeResponse.json();
    console.log("V4 authorize response:", JSON.stringify(authorizeData));

    if (!authorizeResponse.ok || authorizeData.status !== "success") {
      const errorMsg = authorizeData.error?.message || authorizeData.message || "Authorization failed";
      throw new Error(errorMsg);
    }

    const responseData: Record<string, any> = {
      charge_id: authorizeData.data.id,
      status: authorizeData.data.status,
    };

    const nextAction = authorizeData.data.next_action;
    if (nextAction) {
      responseData.next_action = nextAction;
      if (nextAction.type === "redirect_url" && nextAction.redirect_url?.url) {
        responseData.redirect_url = nextAction.redirect_url.url;
      }
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in authorize-flutterwave:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
