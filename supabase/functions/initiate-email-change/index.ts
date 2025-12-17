import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

    const { newEmail } = await req.json();

    if (!newEmail || !newEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Valid new email is required" }),
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

    const oldEmail = user.email;
    if (!oldEmail) {
      return new Response(
        JSON.stringify({ error: "Current email not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if new email is already in use
    const { data: users } = await supabase.auth.admin.listUsers();
    const emailExists = users?.users?.some(u => u.email?.toLowerCase() === newEmail.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "This email is already in use by another account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate any existing pending email changes for this user
    await supabase
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user.id)
      .is("completed_at", null);

    // Create new pending email change
    const confirmationToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { error: insertError } = await supabase
      .from("pending_email_changes")
      .insert({
        user_id: user.id,
        old_email: oldEmail.toLowerCase(),
        new_email: newEmail.toLowerCase(),
        confirmation_token: confirmationToken,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to create email change request");
    }

    // Get the app URL for the confirmation link
    const appUrl = req.headers.get("origin") || "https://quickfollowers.online";
    const confirmLink = `${appUrl}/confirm-email-change?token=${confirmationToken}`;

    // Send warning email to old email with magic link
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
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Security Alert: Email Change Request</p>
          </div>
          
          <p style="color: #333; margin-bottom: 15px;">
            Someone has requested to change the email address associated with your QuickFollowers account from:
          </p>
          
          <p style="color: #666; margin-bottom: 5px;"><strong>Current email:</strong> ${oldEmail}</p>
          <p style="color: #666; margin-bottom: 20px;"><strong>New email:</strong> ${newEmail}</p>
          
          <p style="color: #333; margin-bottom: 20px;">
            If you initiated this request, click the button below to confirm. You will then receive a verification code at your new email address.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Confirm Email Change
            </a>
          </div>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: #721c24; margin: 0; font-size: 14px;">
              <strong>⚠️ Didn't request this?</strong><br>
              If you did not initiate this email change, please change your password immediately as someone may have access to your account.
            </p>
          </div>
          
          <p style="color: #999; text-align: center; font-size: 12px;">
            This confirmation link expires in 24 hours.
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
        to: [oldEmail],
        subject: "Security Alert: Email Change Request - QuickFollowers",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      throw new Error("Failed to send confirmation email");
    }

    console.log("Email change initiation email sent to old email");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email sent to your current email address. Please check your inbox and click the confirmation link first." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error initiating email change:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to initiate email change" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});