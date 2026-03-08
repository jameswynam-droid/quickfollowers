import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid or expired token");
    }

    // Parse request body
    const { amount, redirect_url, payment_type } = await req.json();
    console.log("Received request:", { amount, redirect_url, userId: user.id });

    if (!amount || amount < 100) {
      throw new Error("Minimum amount is 100 NGN");
    }

    // Get user's profile for email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Could not fetch user profile");
    }

    // Generate unique transaction reference
    const txRef = `QF-FLW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Initialize Flutterwave payment
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flutterwaveSecretKey) {
      throw new Error("Flutterwave secret key not configured");
    }

    // Redirect URL goes to verify-flutterwave which will verify payment status
    const verifyRedirectUrl = `${supabaseUrl}/functions/v1/verify-flutterwave?tx_ref=${txRef}&origin=${encodeURIComponent(redirect_url || '')}`;
    
      const payloadBody: Record<string, any> = {
        tx_ref: txRef,
        amount: amount,
        currency: "NGN",
        redirect_url: verifyRedirectUrl,
        customer: {
          email: profile.email,
          name: profile.full_name || profile.email.split("@")[0],
        },
        meta: {
          user_id: user.id,
          base_amount: amount,
        },
        customizations: {
          title: "QuickFollowers",
          description: "Add funds to your account",
        },
      };

      // If mobile money is requested, restrict payment options
      if (payment_type === "mobilemoney") {
        payloadBody.payment_options = "mobilemoney,mobilemoneyghana,mobilemoneyfranco,mobilemoneyuganda,mobilemoneyrwanda,mobilemoneyzambia,mpesa";
      }

      const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadBody),
      });

    const flutterwaveData = await flutterwaveResponse.json();
    console.log("Flutterwave response:", flutterwaveData);

    if (!flutterwaveResponse.ok || flutterwaveData.status !== "success") {
      console.error("Flutterwave error:", flutterwaveData);
      throw new Error(flutterwaveData.message || "Failed to initialize Flutterwave payment");
    }

    return new Response(
      JSON.stringify({
        payment_url: flutterwaveData.data.link,
        tx_ref: txRef,
        amount: amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in initialize-flutterwave:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
