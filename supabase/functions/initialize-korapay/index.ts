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
    const { amount, redirect_url } = await req.json();
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

    // Generate unique reference
    const reference = `QF-KORA-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Initialize Kora Pay checkout
    const korapaySecretKey = Deno.env.get("KORAPAY_SECRET_KEY");
    if (!korapaySecretKey) {
      throw new Error("Kora Pay secret key not configured");
    }

    // Callback URL for webhook notifications
    const callbackUrl = `${supabaseUrl}/functions/v1/verify-korapay?reference=${reference}`;
    
    // Redirect URL goes to verify-korapay which will verify payment status before redirecting to success/failure
    const verifyRedirectUrl = `${supabaseUrl}/functions/v1/verify-korapay?reference=${reference}&origin=${encodeURIComponent(redirect_url || '')}`;
    
    const korapayResponse = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${korapaySecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        currency: "NGN",
        reference: reference,
        notification_url: callbackUrl,
        redirect_url: verifyRedirectUrl,
        customer: {
          name: profile.full_name || profile.email.split("@")[0],
          email: profile.email,
        },
        metadata: {
          user_id: user.id,
          base_amount: amount,
        },
        merchant_bears_cost: true, // No fees for customer
      }),
    });

    const korapayData = await korapayResponse.json();
    console.log("Kora Pay response:", korapayData);

    if (!korapayResponse.ok || !korapayData.status) {
      console.error("Kora Pay error:", korapayData);
      throw new Error(korapayData.message || "Failed to initialize Kora Pay checkout");
    }

    return new Response(
      JSON.stringify({
        checkout_url: korapayData.data.checkout_url,
        reference: reference,
        amount: amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in initialize-korapay:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
