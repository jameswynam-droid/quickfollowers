import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Mail, AlertTriangle } from "lucide-react";

type SettingsMode = 'menu' | 'change-password' | 'change-password-otp' | 'change-password-new' | 'change-email' | 'change-email-pending';

interface AccountSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export const AccountSettingsModal = ({ open, onOpenChange, userEmail }: AccountSettingsModalProps) => {
  const [mode, setMode] = useState<SettingsMode>('menu');
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [rateLimitMessage, setRateLimitMessage] = useState("");
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const resetState = () => {
    setMode('menu');
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewEmail("");
    setOtp("");
    setResendCooldown(0);
    setRateLimitMessage("");
    setShowPasswordRequirements(false);
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? "text-green-500" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  const sendOTP = async (email: string, type: string) => {
    const response = await supabase.functions.invoke('send-otp', {
      body: { email, type }
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send OTP");
    }

    if (response.data?.rateLimited) {
      setRateLimitMessage("You've reached your OTP verification limit for today. Please try again tomorrow.");
      throw new Error("Rate limit exceeded");
    }

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  };

  const verifyOTP = async (email: string, code: string, type: string) => {
    const response = await supabase.functions.invoke('verify-otp', {
      body: { email, code, type }
    });

    if (response.error) {
      const errorBody = response.error.message;
      if (errorBody?.includes("Invalid or expired OTP")) {
        throw new Error("Invalid or expired verification code. Please try again.");
      }
      throw new Error("Failed to verify code. Please try again.");
    }

    if (response.data?.error) {
      if (response.data.error.includes("Invalid or expired")) {
        throw new Error("Invalid or expired verification code. Please try again.");
      }
      throw new Error(response.data.error);
    }

    return response.data;
  };

  const handleStartPasswordChange = async () => {
    setLoading(true);
    setRateLimitMessage("");
    try {
      await sendOTP(userEmail, 'password_change');
      toast.success("Verification code sent to your email!");
      setMode('change-password-otp');
      setResendCooldown(60);
    } catch (error: any) {
      if (error.message !== "Rate limit exceeded") {
        toast.error(error.message || "Failed to send OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    
    setLoading(true);
    try {
      await verifyOTP(userEmail, otp, 'password_change');
      toast.success("Code verified! Enter your new password.");
      setMode('change-password-new');
    } catch (error: any) {
      toast.error(error.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEmailChange = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (newEmail.toLowerCase() === userEmail.toLowerCase()) {
      toast.error("New email must be different from current email");
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('initiate-email-change', {
        body: { newEmail }
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to initiate email change");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Confirmation email sent to your current email address!");
      setMode('change-email-pending');
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate email change");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setRateLimitMessage("");
    try {
      await sendOTP(userEmail, 'password_change');
      toast.success("New verification code sent!");
      setResendCooldown(60);
    } catch (error: any) {
      if (error.message !== "Rate limit exceeded") {
        toast.error(error.message || "Failed to resend code");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (rateLimitMessage) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-center">{rateLimitMessage}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setRateLimitMessage("")}>
            Go Back
          </Button>
        </div>
      );
    }

    switch (mode) {
      case 'menu':
        return (
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={handleStartPasswordChange} disabled={loading}>
              {loading ? "Sending..." : "Change Password"}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setMode('change-email')}>
              Change Email Address
            </Button>
          </div>
        );

      case 'change-password-otp':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code sent to {userEmail}
            </p>
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
            <p className="text-xs text-muted-foreground text-center">
              Didn't receive the code?{" "}
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                className={`text-primary hover:underline ${resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </button>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>Back</Button>
              <Button className="flex-1" onClick={handleVerifyPasswordOTP} disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>
        );

      case 'change-password-new':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setShowPasswordRequirements(true)}
                placeholder="••••••••"
              />
              {showPasswordRequirements && (
                <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium text-foreground mb-2">Password must contain:</p>
                  <RequirementItem met={hasMinLength} text="At least 8 characters" />
                  <RequirementItem met={hasUppercase} text="At least one uppercase letter" />
                  <RequirementItem met={hasLowercase} text="At least one lowercase letter" />
                  <RequirementItem met={hasNumber} text="At least one number" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              {confirmPassword && (
                <div className="mt-1 flex items-center gap-2 text-sm">
                  {passwordsMatch ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-500">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>Cancel</Button>
              <Button className="flex-1" onClick={handleUpdatePassword} disabled={loading || !isPasswordValid || !passwordsMatch}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        );

      case 'change-email':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                How email change works:
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>We'll send a confirmation link to your current email ({userEmail})</li>
                <li>Click the link to confirm you want to change your email</li>
                <li>A verification code will be sent to your new email</li>
                <li>Enter the code to complete the change</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={userEmail} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>New Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>Back</Button>
              <Button className="flex-1" onClick={handleStartEmailChange} disabled={loading}>
                {loading ? "Sending..." : "Send Confirmation"}
              </Button>
            </div>
          </div>
        );

      case 'change-email-pending':
        return (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h4 className="font-semibold">Check Your Current Email</h4>
            <p className="text-sm text-muted-foreground">
              We've sent a confirmation link to <strong>{userEmail}</strong>. 
              Please click the link in that email to proceed with the email change.
            </p>
            <p className="text-xs text-muted-foreground">
              After clicking the confirmation link, you'll be taken to a page where you can enter 
              the verification code sent to your new email address.
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> If you didn't request this change, please change your password immediately.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'change-password-otp':
      case 'change-password-new':
        return "Change Password";
      case 'change-email':
        return "Change Email";
      case 'change-email-pending':
        return "Confirmation Sent";
      default:
        return "Account Settings";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          {mode === 'menu' && (
            <DialogDescription>Manage your account security settings</DialogDescription>
          )}
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};