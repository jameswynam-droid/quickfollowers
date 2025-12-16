import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  type: "login" | "signup";
  onClose: () => void;
  onSwitch: () => void;
  onSubmit: (data: any) => void;
}

const AuthModal = ({ isOpen, type, onClose, onSwitch, onSubmit }: AuthModalProps) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (type === "signup") {
      if (!isPasswordValid) {
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        return;
      }
    }
    
    onSubmit(formData);
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-card rounded-2xl p-7 z-50 shadow-2xl animate-in zoom-in-95 duration-300">
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
            <Input
              id="password"
              type="password"
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
              <Input
                id="confirmPassword"
                type="password"
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
            disabled={type === "signup" && (!isPasswordValid || !passwordsMatch)}
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
