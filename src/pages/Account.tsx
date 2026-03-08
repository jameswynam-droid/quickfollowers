import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { CurrencySelector } from "@/components/CurrencySelector";
import { AccountSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Mail, Lock, Check, X, User, Globe } from "lucide-react";
import { useNoIndex } from "@/hooks/useNoIndex";

const Account = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"idle" | "otp" | "new">("idle");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  // Timezone detection
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    checkAuth();
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchProfile(session.user.id);
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data);
  };

  const handleStartPasswordChange = async () => {
    // Verify current password first
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    
    setPasswordLoading(true);
    try {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        toast.error("Current password is incorrect");
        setPasswordLoading(false);
        return;
      }
      
      const response = await supabase.functions.invoke('send-otp', {
        body: { email: user.email, type: 'password_change' }
      });
      if (response.error) {
        const errorMsg = response.error.message || "Failed to send verification code";
        throw new Error(errorMsg.includes("edge function") ? "Unable to send verification code. Please try again." : errorMsg);
      }
      if (response.data?.error) throw new Error(response.data.error);
      
      toast.success("Verification code sent to your email!");
      setPasswordMode("otp");
      setResendCooldown(60);
    } catch (error: any) {
      const errorMsg = error.message || "Failed to send verification code";
      toast.error(errorMsg.includes("edge function") ? "Unable to send verification code. Please try again." : errorMsg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    
    setPasswordLoading(true);
    try {
      const response = await supabase.functions.invoke('verify-otp', {
        body: { email: user.email, code: otp, type: 'password_change' }
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      toast.success("Code verified! Enter your new password.");
      setPasswordMode("new");
    } catch (error: any) {
      toast.error(error.message || "Invalid or expired code");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      setPasswordMode("idle");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      toast.error("New email must be different from current email");
      return;
    }

    setEmailLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth");
        return;
      }
      
      const response = await supabase.functions.invoke('initiate-email-change', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { newEmail }
      });
      if (response.error) {
        const errorMsg = response.error.message || "Failed to initiate email change";
        throw new Error(errorMsg.includes("edge function") ? "Unable to initiate email change. Please try again." : errorMsg);
      }
      if (response.data?.error) throw new Error(response.data.error);
      
      toast.success("Confirmation email sent to your current email address!");
      setNewEmail("");
    } catch (error: any) {
      const errorMsg = error.message || "Failed to initiate email change";
      toast.error(errorMsg.includes("edge function") ? "Unable to initiate email change. Please try again." : errorMsg);
    } finally {
      setEmailLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8"><AccountSkeleton /></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">
                @{profile?.username || profile?.full_name || user?.email?.split('@')[0]}
              </h1>
              <p className="text-white/80 text-sm mt-1">
                Manage your account, security, and preferences
              </p>
            </div>
          </div>
        </div>

        {/* Change Email Card */}
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5" />
              <h2 className="font-semibold">Change email</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Current email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
              <div>
                <Label>New email address</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                />
              </div>
              <Button
                onClick={handleChangeEmail}
                disabled={emailLoading || !newEmail}
                className="w-full"
              >
                {emailLoading ? "Sending..." : "Change Email"}
              </Button>
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to your current email address.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5" />
              <h2 className="font-semibold">Change password</h2>
            </div>

            {passwordMode === "idle" && (
              <div className="space-y-4">
                <div>
                  <Label>Current password</Label>
                  <PasswordInput
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>New password</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {newPassword && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <RequirementItem met={hasMinLength} text="At least 8 characters" />
                    <RequirementItem met={hasUppercase} text="At least one uppercase letter" />
                    <RequirementItem met={hasLowercase} text="At least one lowercase letter" />
                    <RequirementItem met={hasNumber} text="At least one number" />
                  </div>
                )}
                {confirmPassword && (
                  <div className="flex items-center gap-2 text-sm">
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
                <Button
                  onClick={handleStartPasswordChange}
                  disabled={passwordLoading || !newPassword || !isPasswordValid || !passwordsMatch}
                  className="w-full"
                >
                  {passwordLoading ? "Sending..." : "Change password"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters with a mix of letters & numbers.
                </p>
              </div>
            )}

            {passwordMode === "otp" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Enter the 6-digit code sent to {user.email}
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
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setPasswordMode("idle")}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleVerifyOtp} disabled={passwordLoading}>
                    {passwordLoading ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              </div>
            )}

            {passwordMode === "new" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  OTP verified! Now set your new password.
                </p>
                <div>
                  <Label>New password</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {newPassword && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <RequirementItem met={hasMinLength} text="At least 8 characters" />
                    <RequirementItem met={hasUppercase} text="At least one uppercase letter" />
                    <RequirementItem met={hasLowercase} text="At least one lowercase letter" />
                    <RequirementItem met={hasNumber} text="At least one number" />
                  </div>
                )}
                <Button
                  onClick={handleUpdatePassword}
                  disabled={passwordLoading || !isPasswordValid || !passwordsMatch}
                  className="w-full"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5" />
              <h2 className="font-semibold">Timezone</h2>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-3 rounded-lg bg-muted border border-input text-sm"
            >
              <optgroup label="Africa">
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Accra">Africa/Accra (GMT)</option>
                <option value="Africa/Casablanca">Africa/Casablanca (WET)</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                <option value="Europe/Istanbul">Europe/Istanbul (TRT)</option>
              </optgroup>
              <optgroup label="Americas">
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="America/Denver">America/Denver (MST/MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="America/Toronto">America/Toronto (EST/EDT)</option>
                <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
                <option value="America/Mexico_City">America/Mexico_City (CST)</option>
              </optgroup>
              <optgroup label="Asia">
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              </optgroup>
              <optgroup label="Pacific">
                <option value="Pacific/Auckland">Pacific/Auckland (NZST)</option>
                <option value="Pacific/Sydney">Australia/Sydney (AEST)</option>
                <option value="Pacific/Honolulu">Pacific/Honolulu (HST)</option>
              </optgroup>
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Your detected timezone is shown by default.
            </p>
          </CardContent>
        </Card>

        {/* Currency Preference */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">💱</span>
              <h2 className="font-semibold">Currency Preference</h2>
            </div>
            <CurrencySelector variant="full" />
            <p className="text-xs text-muted-foreground mt-2">
              Prices will be displayed in your selected currency.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
