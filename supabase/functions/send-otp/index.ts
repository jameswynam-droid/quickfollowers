import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting: max 3 requests per hour per email
const MAX_REQUESTS_PER_HOUR = 3;
const OTP_EXPIRY_MINUTES = 10;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type = "password_reset" } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting
    const { data: rateLimit } = await supabase
      .from("otp_rate_limits")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      const windowStart = new Date(rateLimit.window_start);
      
      if (windowStart > oneHourAgo) {
        // Within the rate limit window
        if (rateLimit.request_count >= MAX_REQUESTS_PER_HOUR) {
          const resetTime = new Date(windowStart.getTime() + 60 * 60 * 1000);
          const minutesLeft = Math.ceil((resetTime.getTime() - now.getTime()) / 60000);
          
          return new Response(
            JSON.stringify({ 
              error: `Too many requests. Please try again in ${minutesLeft} minutes.`,
              rateLimited: true 
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Increment counter
        await supabase
          .from("otp_rate_limits")
          .update({ request_count: rateLimit.request_count + 1 })
          .eq("email", email.toLowerCase());
      } else {
        // Reset window
        await supabase
          .from("otp_rate_limits")
          .update({ request_count: 1, window_start: now.toISOString() })
          .eq("email", email.toLowerCase());
      }
    } else {
      // Create new rate limit entry
      await supabase
        .from("otp_rate_limits")
        .insert({ email: email.toLowerCase(), request_count: 1, window_start: now.toISOString() });
    }

    // Check if user exists for password reset
    if (type === "password_reset") {
      const { data: users } = await supabase.auth.admin.listUsers();
      const userExists = users?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!userExists) {
        // Don't reveal if user exists - send success but don't actually send email
        return new Response(
          JSON.stringify({ success: true, message: "If an account exists, an OTP has been sent." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Invalidate any existing OTPs for this email and type
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("email", email.toLowerCase())
      .eq("type", type)
      .eq("used", false);

    // Generate and store new OTP
    const otp = generateOTP();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await supabase
      .from("otp_codes")
      .insert({
        email: email.toLowerCase(),
        code: otp,
        type,
        expires_at: expiresAt.toISOString(),
      });

    // Send OTP via Resend REST API
    const subject = type === "password_reset" 
      ? "Reset Your Password - QuickFollowers" 
      : "Verify Your Email - QuickFollowers";

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
            ${type === "password_reset" ? "Password Reset Code" : "Email Verification Code"}
          </h2>
          
          <p style="color: #666; text-align: center; margin-bottom: 30px;">
            ${type === "password_reset" 
              ? "You requested to reset your password. Use the code below to proceed:" 
              : "Use the code below to verify your email address:"}
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
        from: "QuickFollowers <onboarding@resend.dev>",
        to: [email],
        subject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      throw new Error("Failed to send email");
    }

    console.log("OTP email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send OTP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
