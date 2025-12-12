import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'new-password';

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
  const navigate = useNavigate();

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

  const sendOTP = async (emailAddress: string) => {
    const response = await supabase.functions.invoke('send-otp', {
      body: { email: emailAddress, type: 'password_reset' }
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send OTP");
    }

    if (response.data?.rateLimited) {
      throw new Error(response.data.error);
    }

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  };

  const verifyOTP = async (emailAddress: string, code: string) => {
    const response = await supabase.functions.invoke('verify-otp', {
      body: { email: emailAddress, code, type: 'password_reset' }
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to verify OTP");
    }

    if (response.data?.error) {
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
    try {
      await sendOTP(email);
      toast.success("New OTP code sent to your email!");
      setResendCooldown(60); // 60 second cooldown
    } catch (error: any) {
      toast.error(error.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'forgot-password') {
        await sendOTP(email);
        toast.success("OTP code sent to your email!");
        setAuthMode('verify-otp');
        setResendCooldown(60);
      } else if (authMode === 'verify-otp') {
        if (otp.length !== 6) {
          throw new Error("Please enter a valid 6-digit OTP code");
        }
        
        await verifyOTP(email, otp);
        toast.success("OTP verified! Set your new password.");
        setAuthMode('new-password');
      } else if (authMode === 'new-password') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
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
      } else if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;
        
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        
        toast.success("Account created! Check your email and click the verification link to continue.");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'forgot-password': return "Reset Password";
      case 'verify-otp': return "Verify OTP";
      case 'new-password': return "New Password";
      case 'signup': return "Create Account";
      default: return "Welcome Back";
    }
  };

  const getDescription = () => {
    switch (authMode) {
      case 'forgot-password': return "Enter your email to receive a verification code";
      case 'verify-otp': return `Enter the 6-digit code sent to ${email}`;
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
      case 'new-password': return "Update Password";
      case 'signup': return "Sign Up";
      default: return "Sign In";
    }
  };

  const handleBackToLogin = () => {
    setAuthMode('login');
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setResendCooldown(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-center">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            {/* OTP Input - for verify-otp */}
            {authMode === 'verify-otp' && (
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
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            )}

            {/* New Password fields - for new-password */}
            {authMode === 'new-password' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {getButtonText()}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm space-y-2">
            {(authMode === 'forgot-password' || authMode === 'verify-otp' || authMode === 'new-password') ? (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
