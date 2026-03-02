import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  type: "login" | "signup";
  onClose: () => void;
  onSwitch: () => void;
  onSubmit: (data: any) => void;
}

const RESERVED_USERNAMES = ['admin', 'root', 'support', 'moderator', 'api', 'system', 'official', 'help'];

const AuthModal = ({ isOpen, type, onClose, onSwitch, onSubmit }: AuthModalProps) => {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'>('idle');

  // Password validation checks
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Real-time username validation
  useEffect(() => {
    const username = formData.username;
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
        const { data } = await supabase.rpc('check_username_available', {
          requested_username: username
        });
        setUsernameStatus(data ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (type === "signup") {
      if (!isPasswordValid) return;
      if (formData.password !== formData.confirmPassword) return;
      if (usernameStatus !== 'available') return;
    }
    
    onSubmit(formData);
  };

  const getUsernameStatusUI = () => {
    if (usernameStatus === 'idle' || !formData.username) return null;
    switch (usernameStatus) {
      case 'checking':
        return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Checking...</span></div>;
      case 'available':
        return <div className="flex items-center gap-2 text-sm text-green-500"><Check className="h-4 w-4" /><span>Available</span></div>;
      case 'taken':
        return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>Username already exists</span></div>;
      case 'reserved':
        return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>This username is reserved</span></div>;
      case 'invalid':
        return <div className="flex items-center gap-2 text-sm text-destructive"><X className="h-4 w-4" /><span>4-20 chars, letters, numbers & _ only</span></div>;
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

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-card rounded-2xl p-7 z-50 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
        >
          <i className="fa-solid fa-xmark fa-xl"></i>
        </button>

        <h3 className="text-2xl font-bold mb-6 text-card-foreground">
          {type === "login" ? "Login" : "Create Account"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === "signup" && (
            <div>
              <Label htmlFor="fullName" className="text-sm font-medium mb-1">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="mt-1"
              />
            </div>
          )}

          {type === "signup" && (
            <div>
              <Label htmlFor="username" className="text-sm font-medium mb-1">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                required
                maxLength={20}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="your_username"
                className="mt-1"
              />
              <div className="mt-1">{getUsernameStatusUI()}</div>
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-sm font-medium mb-1">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium mb-1">
              Password
            </Label>
            <PasswordInput
              id="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              onFocus={() => type === "signup" && setShowPasswordRequirements(true)}
              className="mt-1"
            />
            {type === "signup" && showPasswordRequirements && (
              <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium text-foreground mb-2">Password must contain:</p>
                <RequirementItem met={hasMinLength} text="At least 8 characters" />
                <RequirementItem met={hasUppercase} text="At least one uppercase letter" />
                <RequirementItem met={hasLowercase} text="At least one lowercase letter" />
                <RequirementItem met={hasNumber} text="At least one number" />
              </div>
            )}
          </div>

          {type === "signup" && (
            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium mb-1">
                Re-enter Password
              </Label>
              <PasswordInput
                id="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1"
              />
              {formData.confirmPassword && (
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

          <Button 
            type="submit" 
            className="w-full"
            disabled={type === "signup" && (!isPasswordValid || !passwordsMatch || usernameStatus !== 'available')}
          >
            {type === "login" ? "Login" : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-center mt-4 text-muted-foreground">
          {type === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={onSwitch} className="text-primary font-semibold hover:underline">
            {type === "login" ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>
    </>
  );
};

export default AuthModal;