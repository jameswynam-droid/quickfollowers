import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Check, X, Loader2, ArrowLeft, Shield, Zap, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNoIndex } from "@/hooks/useNoIndex";
import logoImg from "@/assets/logo.png";

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-otp' | 'new-password' | 'signup-verify-otp';

const RESERVED_USERNAMES = ['admin', 'root', 'support', 'moderator', 'api', 'system', 'official', 'help'];

const Auth = () => {
  useNoIndex();
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const [authMode, setAuthMode] = useState<AuthMode>(mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'>('idle');
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const isUsernameFormatValid = /^[a-z0-9_]{4,20}$/i.test(username);
  const isUsernameReserved = RESERVED_USERNAMES.includes(username.toLowerCase());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (!username || username.length < 4) {
      setUsernameStatus(username.length > 0 ? 'invalid' : 'idle');
      return;
    }
    if (!/^[a-z0-9_]+$/i.test(username) || username.length > 20) {
      setUsernameStatus('invalid');
      return;
    }
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      setUsernameStatus('reserved');
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('check_username_available', { requested_username: username });
        if (error) throw error;
        setUsernameStatus(data ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const [rateLimitMessage, setRateLimitMessage] = useState("");

  // Read an edge function HTTP error body so we surface the specific server message.
  const extractFnErrorMessage = async (err: unknown, fallback: string): Promise<string> => {
    try {
      if (err instanceof FunctionsHttpError) {
        const body: any = await err.context.json().catch(() => null);
        if (body?.error && typeof body.error === "string") return body.error;
      }
    } catch {}
    const m = (err as any)?.message || "";
    if (typeof m === "string" && m && !m.toLowerCase().includes("non-2xx")) return m;
    return fallback;
  };

  const sendOTP = async (emailAddress: string, type: string = 'password_reset') => {
    const response = await supabase.functions.invoke('send-otp', { body: { email: emailAddress, type } });
    if (response.error) {
      const msg = await extractFnErrorMessage(response.error, "We couldn't send your verification code. Please try again.");
      if (msg.toLowerCase().includes("already exists")) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
      throw new Error(msg);
    }
    if (response.data?.rateLimited) {
      setRateLimitMessage("You've reached your OTP verification limit for today. Please try again tomorrow.");
      throw new Error("Rate limit exceeded");
    }
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  };

  const verifyOTP = async (emailAddress: string, code: string, type: string = 'password_reset') => {
    const response = await supabase.functions.invoke('verify-otp', { body: { email: emailAddress, code, type } });
    if (response.error) {
      const msg = await extractFnErrorMessage(response.error, "We couldn't verify your code. Please try again.");
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
        throw new Error("Invalid or expired verification code. Please try again.");
      }
      throw new Error(msg);
    }
    if (response.data?.error) {
      if (response.data.error.includes("Invalid or expired")) throw new Error("Invalid or expired verification code. Please try again.");
      throw new Error(response.data.error);
    }
    return response.data;
  };

  const resetPassword = async (emailAddress: string, newPassword: string) => {
    const response = await supabase.functions.invoke('reset-password', { body: { email: emailAddress, newPassword } });
    if (response.error) throw new Error(response.error.message || "Failed to reset password");
    if (response.data?.error) throw new Error(response.data.error);
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
      if (error.message !== "Rate limit exceeded") toast.error(error.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const normalizedUsername = username.toLowerCase().trim();
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedUsername || !isUsernameFormatValid) throw new Error("Username must be 4-20 characters, using only letters, numbers, and underscores");
        if (isUsernameReserved) throw new Error("This username is reserved. Please choose another.");
        if (usernameStatus === 'taken') throw new Error("Username already exists. Please use another username.");
        if (!isPasswordValid) throw new Error("Password must be at least 8 characters with uppercase, lowercase, and a number");
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const { data: existingUsers } = await supabase.from('profiles').select('email').eq('email', normalizedEmail).maybeSingle();
        if (existingUsers) throw new Error("An account with this email already exists. Please sign in instead.");
        const { data: usernameAvailable } = await supabase.rpc('check_username_available', { requested_username: normalizedUsername });
        if (!usernameAvailable) throw new Error("Username already exists. Please use another username.");
        setUsername(normalizedUsername);
        setEmail(normalizedEmail);
        await sendOTP(normalizedEmail, 'email_verification');
        toast.success("Verification code sent to your email!");
        setAuthMode('signup-verify-otp');
        setResendCooldown(60);
      } else if (authMode === 'signup-verify-otp') {
        if (otp.length !== 6) throw new Error("Please enter a valid 6-digit OTP code");
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();
        await verifyOTP(normalizedEmail, otp, 'email_verification');
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: fullName, username: normalizedUsername, email_verified: true } },
        });
        if (error) {
          const m = error.message || "";
          if (/already|registered|exists/i.test(m)) throw new Error("An account with this email already exists. Please sign in instead.");
          throw error;
        }
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        // Sign the user in immediately and redirect to dashboard
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInError) {
          // Account exists but sign-in failed (rare) — fall back to login screen with message
          toast.success("Account created. Please sign in.");
          setAuthMode('login');
          setPassword(""); setConfirmPassword(""); setOtp("");
          return;
        }
        localStorage.setItem('session_start', Date.now().toString());
        toast.success("Welcome to QuickFollowers!");
        navigate('/dashboard');
        return;
      } else if (authMode === 'forgot-password') {
        await sendOTP(email);
        toast.success("OTP code sent to your email!");
        setAuthMode('verify-otp');
        setResendCooldown(60);
      } else if (authMode === 'verify-otp') {
        if (otp.length !== 6) throw new Error("Please enter a valid 6-digit OTP code");
        await verifyOTP(email, otp, 'password_reset');
        toast.success("OTP verified! Set your new password.");
        setAuthMode('new-password');
        setPassword("");
        setConfirmPassword("");
      } else if (authMode === 'new-password') {
        if (!isPasswordValid) throw new Error("Password must be at least 8 characters with uppercase, lowercase, and a number");
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        await resetPassword(email, password);
        toast.success("Password updated successfully! Please sign in.");
        setAuthMode('login');
        setPassword(""); setConfirmPassword(""); setOtp("");
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Store session metadata
        localStorage.setItem('session_start', Date.now().toString());
        localStorage.setItem('remember_me', rememberMe ? 'true' : 'false');
        toast.success("Welcome back!");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message !== "Rate limit exceeded") toast.error(error.message || "Authentication failed");
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
      case 'signup': return "Join thousands growing their social media";
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
    setOtp(""); setPassword(""); setConfirmPassword(""); setUsername("");
    setUsernameStatus('idle'); setResendCooldown(0); setRateLimitMessage("");
    setShowPasswordRequirements(false);
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {met ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
      <span className={met ? "text-green-500" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (authMode === 'signup') return !isPasswordValid || !passwordsMatch || usernameStatus !== 'available';
    if (authMode === 'new-password') return !isPasswordValid || !passwordsMatch;
    return false;
  };

  const getUsernameStatusUI = () => {
    if (usernameStatus === 'idle' || !username) return null;
    switch (usernameStatus) {
      case 'checking': return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Checking availability...</span></div>;
      case 'available': return <div className="flex items-center gap-2 text-sm text-green-500"><Check className="h-4 w-4" /><span>Available</span></div>;
      case 'taken': return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>Username already exists</span></div>;
      case 'reserved': return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>This username is reserved</span></div>;
      case 'invalid': return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>4-20 characters, letters, numbers & underscore only</span></div>;
    }
  };

  const features = [
    { icon: Zap, title: "Instant Delivery", desc: "Orders start processing within minutes" },
    { icon: Shield, title: "Secure Payments", desc: "256-bit encryption on all transactions" },
    { icon: Users, title: "Real Engagement", desc: "High-quality followers & interactions" },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] gradient-primary relative overflow-hidden flex-col justify-between p-10 text-primary-foreground">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg">
              <img src={logoImg} alt="QuickFollowers" className="w-full h-full object-cover" width="40" height="40" />
            </div>
            <span className="text-2xl font-black">QuickFollowers</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
              Grow your social media<br />presence effortlessly
            </h2>
            <p className="mt-4 text-primary-foreground/80 text-lg max-w-md">
              Trusted by thousands of creators and businesses to boost their online reach.
            </p>
          </div>

          <div className="space-y-5">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-primary-foreground/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} QuickFollowers. All rights reserved.
        </p>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <Link to="/" className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                <img src={logoImg} alt="QuickFollowers" className="w-full h-full object-cover" width="64" height="64" />
              </div>
              <span className="text-xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">QuickFollowers</span>
            </Link>
          </div>

          {/* Back button for sub-flows */}
          {(authMode !== 'login' && authMode !== 'signup') && (
            <button onClick={handleBackToLogin} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>
          )}

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {rateLimitMessage ? "Limit Reached" : getTitle()}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {rateLimitMessage ? "" : getDescription()}
            </p>
          </div>

          {rateLimitMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-center">{rateLimitMessage}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleBackToLogin}>Back to Sign In</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
                </div>
              )}

              {authMode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="your_username" maxLength={20} required />
                  <div className="mt-1">{getUsernameStatusUI()}</div>
                </div>
              )}

              {(authMode === 'login' || authMode === 'signup' || authMode === 'forgot-password') && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
              )}

              {(authMode === 'verify-otp' || authMode === 'signup-verify-otp') && (
                <div className="space-y-2">
                  <Label>Verification Code</Label>
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
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Didn't receive the code?{" "}
                    <button type="button" onClick={handleResendOTP} disabled={resendCooldown > 0 || loading} className={`text-primary hover:underline ${resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                    </button>
                  </p>
                </div>
              )}

              {(authMode === 'login' || authMode === 'signup') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {authMode === 'login' && (
                      <button type="button" onClick={() => setAuthMode('forgot-password')} className="text-xs text-primary hover:underline">Forgot password?</button>
                    )}
                  </div>
                  <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => authMode === 'signup' && setShowPasswordRequirements(true)} placeholder="••••••••" required />
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

              {authMode === 'login' && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Remember me
                  </Label>
                </div>
              )}

              {authMode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Re-enter Password</Label>
                  <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                  {confirmPassword && (
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      {passwordsMatch ? <><Check className="h-4 w-4 text-green-500" /><span className="text-green-500">Passwords match</span></> : <><X className="h-4 w-4 text-destructive" /><span className="text-destructive">Passwords do not match</span></>}
                    </div>
                  )}
                </div>
              )}

              {authMode === 'new-password' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <PasswordInput id="newPassword" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setShowPasswordRequirements(true)} placeholder="••••••••" required />
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
                    <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                    {confirmPassword && (
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        {passwordsMatch ? <><Check className="h-4 w-4 text-green-500" /><span className="text-green-500">Passwords match</span></> : <><X className="h-4 w-4 text-destructive" /><span className="text-destructive">Passwords do not match</span></>}
                      </div>
                    )}
                  </div>
                </>
              )}

              <Button type="submit" className="w-full h-11" disabled={isSubmitDisabled()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {getButtonText()}
              </Button>
            </form>
          )}

          {!rateLimitMessage && (authMode === 'login' || authMode === 'signup') && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or</span></div>
            </div>
          )}

          {!rateLimitMessage && (authMode === 'login' || authMode === 'signup') && (
            <p className="text-center text-sm text-muted-foreground">
              {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-primary font-semibold hover:underline">
                {authMode === 'login' ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
