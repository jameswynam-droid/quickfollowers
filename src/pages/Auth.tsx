import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'new-password' | 'signup-verify-otp';

const Auth = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const [authMode, setAuthMode] = useState<AuthMode>(mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const navigate = useNavigate();

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const [rateLimitMessage, setRateLimitMessage] = useState("");

  const sendOTP = async (emailAddress: string, type: string = 'password_reset') => {
    const response = await supabase.functions.invoke('send-otp', {
      body: { email: emailAddress, type }
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

  const verifyOTP = async (emailAddress: string, code: string, type: string = 'password_reset') => {
    const response = await supabase.functions.invoke('verify-otp', {
      body: { email: emailAddress, code, type }
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

  const resetPassword = async (emailAddress: string, newPassword: string) => {
    const response = await supabase.functions.invoke('reset-password', {
      body: { email: emailAddress, newPassword }
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to reset password");
    }

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setRateLimitMessage("");
    try {
      const type = authMode === 'signup-verify-otp' ? 'email_verification' : 'password_reset';
      await sendOTP(email, type);
      toast.success("New OTP code sent to your email!");
      setResendCooldown(60);
    } catch (error: any) {
      if (error.message !== "Rate limit exceeded") {
        toast.error(error.message || "Failed to resend OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'signup') {
        // Validate password BEFORE sending OTP
        if (!isPasswordValid) {
          throw new Error("Password must be at least 8 characters with uppercase, lowercase, and a number");
        }
        
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        // First check if email already exists
        const { data: existingUsers } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email.toLowerCase())
          .single();
        
        if (existingUsers) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        
        // Send OTP for email verification before creating account
        await sendOTP(email, 'email_verification');
        toast.success("Verification code sent to your email!");
        setAuthMode('signup-verify-otp');
        setResendCooldown(60);
      } else if (authMode === 'signup-verify-otp') {
        if (otp.length !== 6) {
          throw new Error("Please enter a valid 6-digit OTP code");
        }
        
        await verifyOTP(email, otp, 'email_verification');
        
        // Now create the account after email verification
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              email_verified: true,
            },
          },
        });

        if (error) throw error;
        
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        
        toast.success("Account created successfully! Welcome to QuickFollowers!");
      } else if (authMode === 'forgot-password') {
        await sendOTP(email);
        toast.success("OTP code sent to your email!");
        setAuthMode('verify-otp');
        setResendCooldown(60);
      } else if (authMode === 'verify-otp') {
        if (otp.length !== 6) {
          throw new Error("Please enter a valid 6-digit OTP code");
        }
        
        await verifyOTP(email, otp, 'password_reset');
        toast.success("OTP verified! Set your new password.");
        setAuthMode('new-password');
        setPassword("");
        setConfirmPassword("");
      } else if (authMode === 'new-password') {
        if (!isPasswordValid) {
          throw new Error("Password must be at least 8 characters with uppercase, lowercase, and a number");
        }
        
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        await resetPassword(email, password);
        toast.success("Password updated successfully! Please sign in.");
        
        setAuthMode('login');
        setPassword("");
        setConfirmPassword("");
        setOtp("");
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message !== "Rate limit exceeded") {
        toast.error(error.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'forgot-password': return "Reset Password";
      case 'verify-otp': return "Verify OTP";
      case 'signup-verify-otp': return "Verify Email";
      case 'new-password': return "New Password";
      case 'signup': return "Create Account";
      default: return "Welcome Back";
    }
  };

  const getDescription = () => {
    switch (authMode) {
      case 'forgot-password': return "Enter your email to receive a verification code";
      case 'verify-otp': return `Enter the 6-digit code sent to ${email}`;
      case 'signup-verify-otp': return `Enter the 6-digit code sent to ${email}`;
      case 'new-password': return "Create a new password for your account";
      case 'signup': return "Sign up to start boosting your social media";
      default: return "Sign in to manage your orders";
    }
  };

  const getButtonText = () => {
    if (loading) return "Processing...";
    switch (authMode) {
      case 'forgot-password': return "Send OTP Code";
      case 'verify-otp': return "Verify Code";
      case 'signup-verify-otp': return "Verify & Create Account";
      case 'new-password': return "Update Password";
      case 'signup': return "Continue";
      default: return "Sign In";
    }
  };

  const handleBackToLogin = () => {
    setAuthMode('login');
    setOtp("");
    setPassword("");
    setConfirmPassword("");
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

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (authMode === 'signup') {
      return !isPasswordValid || !passwordsMatch;
    }
    if (authMode === 'new-password') {
      return !isPasswordValid || !passwordsMatch;
    }
    return false;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {rateLimitMessage ? "Limit Reached" : getTitle()}
          </CardTitle>
          <CardDescription className="text-center">
            {rateLimitMessage ? "" : getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rateLimitMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-center">{rateLimitMessage}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleBackToLogin}>
                Back to Sign In
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name - only for signup */}
            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            {/* Email - for login, signup, forgot-password */}
            {(authMode === 'login' || authMode === 'signup' || authMode === 'forgot-password') && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            )}

            {/* OTP Input - for verify-otp and signup-verify-otp */}
            {(authMode === 'verify-otp' || authMode === 'signup-verify-otp') && (
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP 
                    value={otp} 
                    onChange={setOtp}
                    maxLength={6}
                  >
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
                <p className="text-xs text-muted-foreground text-center mt-2">
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
              </div>
            )}

            {/* Password - for login, signup */}
            {(authMode === 'login' || authMode === 'signup') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot-password')}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => authMode === 'signup' && setShowPasswordRequirements(true)}
                  placeholder="••••••••"
                  required
                />
                {authMode === 'signup' && showPasswordRequirements && (
                  <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                    <p className="text-sm font-medium text-foreground mb-2">Password must contain:</p>
                    <RequirementItem met={hasMinLength} text="At least 8 characters" />
                    <RequirementItem met={hasUppercase} text="At least one uppercase letter" />
                    <RequirementItem met={hasLowercase} text="At least one lowercase letter" />
                    <RequirementItem met={hasNumber} text="At least one number" />
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password - for signup */}
            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Re-enter Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
            )}

            {/* New Password fields - for new-password */}
            {authMode === 'new-password' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <PasswordInput
                    id="newPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setShowPasswordRequirements(true)}
                    placeholder="••••••••"
                    required
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
                  <Label htmlFor="confirmPassword">Re-enter Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
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
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitDisabled()}
            >
              {getButtonText()}
            </Button>
          </form>
          )}

          {!rateLimitMessage && (
          <div className="mt-4 text-center text-sm space-y-2">
            {(authMode === 'forgot-password' || authMode === 'verify-otp' || authMode === 'new-password' || authMode === 'signup-verify-otp') ? (
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-primary hover:underline"
              >
                {authMode === 'login'
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            )}
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;