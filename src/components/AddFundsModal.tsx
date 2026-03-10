import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard } from "lucide-react";

interface AddFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddFundsModal = ({ open, onOpenChange }: AddFundsModalProps) => {
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<"form" | "pin" | "otp" | "processing">("form");
  const [pinValue, setPinValue] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [chargeId, setChargeId] = useState("");
  const { toast } = useToast();

  const amountNum = parseFloat(amount) || 0;

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountNum || amountNum < 100) {
      toast({ title: "Invalid Amount", description: "Minimum deposit is ₦100", variant: "destructive" });
      return;
    }

    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    if (cleanCardNumber.length < 13 || !expiryMonth || !expiryYear || !cvv) {
      toast({ title: "Invalid Card", description: "Please fill in all card details", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const redirect_url = window.location.origin;

      const { data, error } = await supabase.functions.invoke("initialize-flutterwave", {
        body: {
          amount: amountNum,
          redirect_url,
          payment_type: "card",
          currency: "NGN",
          card_number: cleanCardNumber,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          cvv,
        },
      });

      if (error) throw error;

      setChargeId(data.charge_id);

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }

      if (data.next_action?.type === "requires_pin") {
        setAuthStep("pin");
      } else if (data.next_action?.type === "requires_otp") {
        setAuthStep("otp");
      } else if (data.status === "succeeded") {
        toast({ title: "Payment Successful", description: "Funds have been added to your balance." });
        onOpenChange(false);
      } else {
        throw new Error("Unexpected payment response");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({ title: "Payment Error", description: error.message || "Failed to process payment.", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleAuthorize = async () => {
    setAuthStep("processing");
    try {
      const body: any = { charge_id: chargeId };
      if (pinValue) { body.authorization_type = "pin"; body.pin = pinValue; }
      else if (otpValue) { body.authorization_type = "otp"; body.otp = otpValue; }

      const { data, error } = await supabase.functions.invoke("authorize-flutterwave", { body });
      if (error) throw error;

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }

      if (data.next_action?.type === "requires_otp") {
        setPinValue("");
        setOtpValue("");
        setAuthStep("otp");
      } else {
        toast({ title: "Payment Successful", description: "Funds have been added to your balance." });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({ title: "Authorization Failed", description: error.message, variant: "destructive" });
      setAuthStep("form");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>
            Enter your card details to add funds to your balance.
          </DialogDescription>
        </DialogHeader>

        {authStep === "form" && (
          <form onSubmit={handleAddFunds} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-amount">Amount (NGN)</Label>
              <Input id="modal-amount" type="number" step="0.01" min="100" placeholder="Minimum ₦100" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-card">Card Number</Label>
              <Input id="modal-card" placeholder="1234 5678 9012 3456" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} disabled={loading} required autoComplete="cc-number" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="modal-mm">Month</Label>
                <Input id="modal-mm" placeholder="MM" value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} maxLength={2} disabled={loading} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-yy">Year</Label>
                <Input id="modal-yy" placeholder="YY" value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 2))} maxLength={2} disabled={loading} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-cvv">CVV</Label>
                <Input id="modal-cvv" type="password" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} disabled={loading} required />
              </div>
            </div>
            {amountNum > 0 && (
              <div className="rounded-lg border bg-muted p-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>₦{amountNum.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay ₦{amountNum.toFixed(2)}
              </Button>
            </div>
          </form>
        )}

        {authStep === "pin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your card PIN to authorize this payment</p>
            <Input type="password" placeholder="Enter PIN" value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus />
            <Button onClick={handleAuthorize} className="w-full" disabled={!pinValue}>Authorize</Button>
          </div>
        )}

        {authStep === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the OTP sent to your phone/email</p>
            <Input type="text" placeholder="Enter OTP" value={otpValue} onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))} maxLength={8} autoFocus />
            <Button onClick={handleAuthorize} className="w-full" disabled={!otpValue}>Verify OTP</Button>
          </div>
        )}

        {authStep === "processing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing payment...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
