import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { newEmail, code } = await req.json();

    if (!newEmail || !code) {
      return new Response(
        JSON.stringify({ error: "Email and verification code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find pending email change that has old email confirmed
    const { data: pendingChange, error: findError } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user.id)
      .eq("new_email", newEmail.toLowerCase())
      .eq("old_email_confirmed", true)
      .is("completed_at", null)
      .single();

    if (findError || !pendingChange) {
      return new Response(
        JSON.stringify({ error: "No pending email change found or old email not confirmed. Please click the confirmation link in your old email first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(pendingChange.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This email change request has expired. Please start the process again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify OTP
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", newEmail.toLowerCase())
      .eq("code", code)
      .eq("type", "email_change")
      .eq("used", false)
      .single();

    if (otpError || !otpData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP expired
    if (new Date(otpData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Verification code has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Update user email in Supabase Auth
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(user.id, {
      email: newEmail.toLowerCase(),
      email_confirm: true,
    });

    if (updateAuthError) {
      console.error("Auth update error:", updateAuthError);
      throw new Error("Failed to update email in authentication system");
    }

    // Update email in profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ email: newEmail.toLowerCase() })
      .eq("id", user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Mark the email change as completed
    await supabase
      .from("pending_email_changes")
      .update({ 
        completed_at: new Date().toISOString(),
        new_email_verified: true 
      })
      .eq("id", pendingChange.id);

    console.log("Email change completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email updated successfully! Please sign in with your new email." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error completing email change:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to complete email change" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});