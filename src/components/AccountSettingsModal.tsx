import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SettingsMode = 'menu' | 'change-password' | 'change-password-otp' | 'change-password-new' | 'change-email' | 'change-email-otp' | 'change-email-new';

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
  };

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
      throw new Error(response.error.message || "Failed to verify OTP");
    }

    if (response.data?.error) {
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
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
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

    setLoading(true);
    setRateLimitMessage("");
    try {
      await sendOTP(newEmail, 'email_change');
      toast.success("Verification code sent to your new email!");
      setMode('change-email-otp');
      setResendCooldown(60);
    } catch (error: any) {
      if (error.message !== "Rate limit exceeded") {
        toast.error(error.message || "Failed to send OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    
    setLoading(true);
    try {
      await verifyOTP(newEmail, otp, 'email_change');
      
      // Update email in Supabase Auth
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      // Update email in profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ email: newEmail.toLowerCase() }).eq('id', user.id);
      }
      
      toast.success("Email updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setRateLimitMessage("");
    try {
      const email = mode === 'change-email-otp' ? newEmail : userEmail;
      const type = mode === 'change-email-otp' ? 'email_change' : 'password_change';
      await sendOTP(email, type);
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
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>Cancel</Button>
              <Button className="flex-1" onClick={handleUpdatePassword} disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        );

      case 'change-email':
        return (
          <div className="space-y-4">
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
                {loading ? "Sending..." : "Send Verification"}
              </Button>
            </div>
          </div>
        );

      case 'change-email-otp':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code sent to {newEmail}
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
              <Button variant="outline" className="flex-1" onClick={() => setMode('change-email')}>Back</Button>
              <Button className="flex-1" onClick={handleVerifyEmailOTP} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Update"}
              </Button>
            </div>
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
      case 'change-email-otp':
        return "Change Email";
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
