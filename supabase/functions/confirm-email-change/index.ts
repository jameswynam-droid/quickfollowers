import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OTP_EXPIRY_MINUTES = 10;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Confirmation token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the pending email change
    const { data: pendingChange, error: findError } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("confirmation_token", token)
      .is("completed_at", null)
      .single();

    if (findError || !pendingChange) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired confirmation link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(pendingChange.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This confirmation link has expired. Please start the email change process again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark old email as confirmed
    const { error: updateError } = await supabase
      .from("pending_email_changes")
      .update({ old_email_confirmed: true })
      .eq("id", pendingChange.id);

    if (updateError) {
      throw new Error("Failed to confirm email change");
    }

    // Generate and store OTP for new email
    const otp = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing OTPs for this new email
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("email", pendingChange.new_email)
      .eq("type", "email_change")
      .eq("used", false);

    // Store new OTP
    await supabase
      .from("otp_codes")
      .insert({
        email: pendingChange.new_email,
        code: otp,
        type: "email_change",
        expires_at: expiresAt.toISOString(),
      });

    // Send OTP to new email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">QuickFollowers</h1>
          </div>
          
          <h2 style="color: #333; text-align: center; margin-bottom: 20px;">
            Email Verification Code
          </h2>
          
          <p style="color: #666; text-align: center; margin-bottom: 30px;">
            Use the code below to verify your new email address and complete the email change:
          </p>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
            <span style="font-size: 32px; font-weight: bold; color: white; letter-spacing: 8px;">${otp}</span>
          </div>
          
          <p style="color: #999; text-align: center; font-size: 14px; margin-bottom: 20px;">
            This code expires in ${OTP_EXPIRY_MINUTES} minutes.
          </p>
          
          <p style="color: #999; text-align: center; font-size: 12px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "QuickFollowers <no-reply@quickfollowers.online>",
        to: [pendingChange.new_email],
        subject: "Verify Your New Email - QuickFollowers",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      throw new Error("Failed to send verification email");
    }

    console.log("OTP sent to new email for verification");

    return new Response(
      JSON.stringify({ 
        success: true, 
        newEmail: pendingChange.new_email,
        message: "Old email confirmed! A verification code has been sent to your new email address." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error confirming email change:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to confirm email change" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});