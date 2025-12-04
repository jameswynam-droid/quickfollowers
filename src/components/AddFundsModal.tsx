import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AddFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddFundsModal = ({ open, onOpenChange }: AddFundsModalProps) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate fee for display
  const calculateFee = (baseAmount: number) => {
    const percentageFee = baseAmount * 0.015; // 1.5%
    const fixedFee = baseAmount < 2500 ? 0 : 100; // Waive ₦100 if under ₦2,500
    return percentageFee + fixedFee;
  };

  const amountNum = parseFloat(amount) || 0;
  const fee = calculateFee(amountNum);
  const total = amountNum + fee;

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Pass the current origin as redirect URL so we come back to the right place
      const redirect_url = window.location.origin;
      
      const { data, error } = await supabase.functions.invoke('initialize-payment', {
        body: { amount: amountNum, redirect_url },
      });

      if (error) throw error;

      console.log('Payment initialization response:', data);

      // Redirect to Paystack payment page
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>
            Enter the amount you want to add to your balance. You'll be redirected to Paystack for secure payment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Add (NGN)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          {amountNum > 0 && (
            <div className="rounded-lg border bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Amount:</span>
                <span className="font-medium">₦{amountNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction Fee (1.5%{amountNum >= 2500 ? ' + ₦100' : ''}):</span>
                <span className="font-medium">₦{fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="font-semibold">Total to Pay:</span>
                <span className="font-semibold">₦{total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                ₦{amountNum.toFixed(2)} will be added to your balance
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay ₦{total.toFixed(2)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};