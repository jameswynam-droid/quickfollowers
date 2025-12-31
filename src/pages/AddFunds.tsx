import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Wallet, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { useRouteTheme } from "@/hooks/useRouteTheme";
import { cn } from "@/lib/utils";

type PaymentMethod = "korapay" | "paystack";

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  fee: string;
  feeCalculation: (amount: number) => number;
  recommended?: boolean;
  icon: React.ReactNode;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "korapay",
    name: "Kora Pay",
    description: "Pay with card, bank transfer, or USSD",
    fee: "No fees",
    feeCalculation: () => 0,
    recommended: true,
    icon: <Wallet className="h-6 w-6" />,
  },
  {
    id: "paystack",
    name: "Paystack",
    description: "Pay with card or bank transfer",
    fee: "1.5% + ₦100 (waived under ₦2,500)",
    feeCalculation: (amount: number) => {
      const percentageFee = amount * 0.015;
      const fixedFee = amount < 2500 ? 0 : 100;
      return percentageFee + fixedFee;
    },
    icon: <CreditCard className="h-6 w-6" />,
  },
];

export default function AddFunds() {
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("korapay");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useRouteTheme("dark");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  const amountNum = parseFloat(amount) || 0;
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedMethod)!;
  const fee = selectedPaymentMethod.feeCalculation(amountNum);
  const total = amountNum + fee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountNum || amountNum < 100) {
      toast({
        title: "Invalid Amount",
        description: "Minimum deposit is ₦100",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const redirect_url = window.location.origin;
      
      if (selectedMethod === "korapay") {
        const { data, error } = await supabase.functions.invoke("initialize-korapay", {
          body: { amount: amountNum, redirect_url },
        });

        if (error) throw error;

        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          throw new Error("No checkout URL received");
        }
      } else {
        const { data, error } = await supabase.functions.invoke("initialize-payment", {
          body: { amount: amountNum, redirect_url },
        });

        if (error) throw error;

        if (data.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error("No authorization URL received");
        }
      }
    } catch (error: any) {
      console.error("Error initializing payment:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Add Funds</h1>
            <p className="text-muted-foreground">
              Choose your preferred payment method and enter the amount
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Amount</CardTitle>
                <CardDescription>Enter the amount you want to add (minimum ₦100)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    ₦
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="100"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 text-lg h-12"
                    required
                    disabled={loading}
                  />
                </div>
                
                {/* Quick amount buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {[500, 1000, 2000, 5000, 10000].map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(quickAmount.toString())}
                      disabled={loading}
                    >
                      ₦{quickAmount.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
                <CardDescription>Select how you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    onClick={() => !loading && setSelectedMethod(method.id)}
                    className={cn(
                      "relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-full",
                        selectedMethod === method.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{method.name}</span>
                        {method.recommended && (
                          <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                            <Sparkles className="h-3 w-3" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{method.description}</p>
                      <p className={cn(
                        "text-sm font-medium mt-1",
                        method.feeCalculation(amountNum) === 0 ? "text-green-500" : "text-orange-500"
                      )}>
                        {method.fee}
                      </p>
                    </div>
                    {selectedMethod === method.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary absolute top-4 right-4" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary */}
            {amountNum > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount to add:</span>
                      <span className="font-medium">₦{amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction fee:</span>
                      <span className={cn(
                        "font-medium",
                        fee === 0 ? "text-green-500" : "text-orange-500"
                      )}>
                        {fee === 0 ? "Free" : `₦${fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-semibold">Total to pay:</span>
                      <span className="font-bold text-lg">₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      ₦{amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })} will be added to your balance
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base"
              disabled={loading || !amountNum}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Pay ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} with {selectedPaymentMethod.name}</>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
