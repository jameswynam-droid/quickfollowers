import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const ConfirmEmailChange = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "confirmed" | "error" | "verifying">("loading");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (token) {
      confirmToken();
    } else {
      setStatus("error");
      setErrorMessage("Invalid confirmation link.");
    }
  }, [token]);

  const confirmToken = async () => {
    try {
      const response = await supabase.functions.invoke("confirm-email-change", {
        body: { token }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setNewEmail(response.data.newEmail);
      setStatus("confirmed");
      toast.success("Email confirmed! Please enter the verification code sent to your new email.");
    } catch (error: any) {
      console.error("Confirmation error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to confirm email change.");
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("complete-email-change", {
        body: { newEmail, code: otp }
      });

      if (response.error) {
        const errorMsg = response.error.message;
        if (errorMsg?.includes("Invalid or expired")) {
          throw new Error("Invalid or expired verification code. Please try again.");
        }
        throw new Error(errorMsg || "Failed to complete email change");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Email updated successfully! Please sign in with your new email.");
      
      // Sign out user so they can sign in with new email
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to verify code");
    } finally {
      setVerifying(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Confirming your email change...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Confirmation Failed</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle>Email Confirmed!</CardTitle>
          <CardDescription>
            A verification code has been sent to {newEmail}. Enter it below to complete the email change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP value={otp} onChange={setOtp} maxLength={6}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleVerifyOTP} 
            disabled={verifying || otp.length !== 6}
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Complete Email Change"
            )}
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => navigate("/dashboard")}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmEmailChange;