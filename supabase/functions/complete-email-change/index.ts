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
    const { newEmail, code } = await req.json();

    if (!newEmail || !code) {
      return new Response(
        JSON.stringify({ error: "Email and verification code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const normalizedEmail = newEmail.toLowerCase().trim();
    
    console.log("Looking for pending email change for new email:", normalizedEmail);
    
    // Find pending email change by new email that has old email confirmed
    const { data: pendingChange, error: findError } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("new_email", normalizedEmail)
      .eq("old_email_confirmed", true)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log("Pending change lookup:", pendingChange, "error:", findError);

    if (findError || !pendingChange) {
      return new Response(
        JSON.stringify({ error: "No pending email change found. Please click the confirmation link in your old email first, then try again." }),
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
    console.log("Looking for OTP with email:", normalizedEmail, "code:", code, "type: email_change");
    
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("code", code)
      .eq("type", "email_change")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log("OTP lookup result:", otpData, "error:", otpError);

    if (otpError || !otpData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Update user email in Supabase Auth using the user_id from the pending change
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(pendingChange.user_id, {
      email: normalizedEmail,
      email_confirm: true,
    });

    if (updateAuthError) {
      console.error("Auth update error:", updateAuthError);
      throw new Error("Failed to update email in authentication system");
    }

    // Update email in profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ email: normalizedEmail })
      .eq("id", pendingChange.user_id);

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

    console.log("Email change completed successfully for user:", pendingChange.user_id);

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
