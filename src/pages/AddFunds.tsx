import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { CurrencyCode } from "@/hooks/currencyData";
import flutterwaveLogo from "@/assets/flutterwave-logo.png";
import paystackLogo from "@/assets/paystack-logo.png";

type PaymentMethod = "paystack" | "flutterwave" | "mobilemoney";

// Mobile money supported currencies and their Flutterwave currency codes
const MOBILE_MONEY_CURRENCIES: Record<string, string> = {
  GHS: "GHS",
  KES: "KES",
  UGX: "UGX",
  RWF: "RWF",
  ZMW: "ZMW",
  XOF: "XOF",
  TZS: "TZS",
  MWK: "MWK",
};

const MOBILE_MONEY_CURRENCY_NAMES: Record<string, string> = {
  GHS: "Ghana (GHS)",
  KES: "Kenya (KES)",
  UGX: "Uganda (UGX)",
  RWF: "Rwanda (RWF)",
  ZMW: "Zambia (ZMW)",
  XOF: "West Africa CFA (XOF)",
  TZS: "Tanzania (TZS)",
  MWK: "Malawi (MWK)",
};

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  fee: string;
  feeCalculation: (amount: number) => number;
  icon: React.ReactNode;
}

interface PaymentSection {
  title: string;
  subtitle: string;
  methods: PaymentMethodOption[];
}

const paymentSections: PaymentSection[] = [
  {
    title: "International Payments",
    subtitle: "For Nigerians and international users",
    methods: [
      {
        id: "flutterwave",
        name: "Flutterwave",
        description: "Pay with card, bank transfer, or USSD",
        fee: "No fees",
        feeCalculation: () => 0,
        icon: <img src={flutterwaveLogo} alt="Flutterwave" className="w-10 h-10 object-contain" width="40" height="40" loading="eager" decoding="async" />,
      },
      {
        id: "mobilemoney",
        name: "Mobile Money",
        description: "Pay with MPesa, MTN, Airtel & other mobile wallets",
        fee: "No fees",
        feeCalculation: () => 0,
        icon: <img src={flutterwaveLogo} alt="Mobile Money" className="w-10 h-10 object-contain" width="40" height="40" loading="eager" decoding="async" />,
      },
    ],
  },
  {
    title: "Local Payments",
    subtitle: "More payment options",
    methods: [
      {
        id: "paystack",
        name: "Paystack",
        description: "Pay with card or bank transfer",
        fee: "1.5% + ₦100 (≤ ₦2,500 waived, capped ₦2,000)",
        feeCalculation: (amount: number) => {
          const percentageFee = amount * 0.015;
          const fixedFee = amount <= 2500 ? 0 : 100;
          const uncappedFee = percentageFee + fixedFee;
          return Math.min(uncappedFee, 2000);
        },
        icon: <img src={paystackLogo} alt="Paystack" className="w-10 h-10 object-contain" width="40" height="40" loading="eager" decoding="async" />,
      },
    ],
  },
];

const allPaymentMethods = paymentSections.flatMap(s => s.methods);

export default function AddFunds() {
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("flutterwave");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currency, currencySymbol, convertFromNGN, convertToNGN } = useCurrency();

  const isMobileMoneySupported = currency in MOBILE_MONEY_CURRENCIES;

  useEffect(() => {
    // If mobile money is selected but currency changed to unsupported, switch to flutterwave
    if (selectedMethod === "mobilemoney" && !isMobileMoneySupported) {
      setSelectedMethod("flutterwave");
    }
  }, [currency, isMobileMoneySupported, selectedMethod]);

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
  const selectedPaymentMethod = allPaymentMethods.find((m) => m.id === selectedMethod)!;
  const fee = selectedPaymentMethod.feeCalculation(amountNum);
  const total = amountNum + fee;

  // Minimum deposit: ₦100 for NGN, ₦500 equivalent for other currencies
  const MIN_NGN = currency === "NGN" ? 100 : 500;
  const minAmount = Math.ceil(convertFromNGN(MIN_NGN));
  const minAmountDisplay = `${currencySymbol}${minAmount.toLocaleString()}`;

  const formatAmount = (val: number) =>
    `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountNum || amountNum < minAmount) {
      toast({
        title: "Invalid Amount",
        description: `Minimum deposit is ${minAmountDisplay} (≈ ₦${MIN_NGN})`,
        variant: "destructive",
      });
      return;
    }

    if (selectedMethod === "mobilemoney" && !isMobileMoneySupported) {
      toast({
        title: "Currency not supported",
        description: "Please select a supported currency for Mobile Money payments.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const redirect_url = window.location.origin;
      // Paystack only supports NGN, so convert for Paystack
      const paystackAmount = Number(convertToNGN(amountNum).toFixed(2));

      if (selectedMethod === "flutterwave" || selectedMethod === "mobilemoney") {
        // For Flutterwave: send the user's display currency & amount so checkout shows their currency
        // Also send the NGN equivalent so the backend can credit the correct NGN balance
        const isMobileMoney = selectedMethod === "mobilemoney";
        const checkoutCurrency = isMobileMoney
          ? MOBILE_MONEY_CURRENCIES[currency]
          : currency === "NGN" ? "NGN" : currency;
        const checkoutAmount = currency === "NGN" ? amountNum : amountNum;
        const ngnEquivalent = Number(convertToNGN(amountNum).toFixed(2));

        const { data, error } = await supabase.functions.invoke("initialize-flutterwave", {
          body: {
            amount: checkoutAmount,
            redirect_url,
            payment_type: isMobileMoney ? "mobilemoney" : undefined,
            currency: checkoutCurrency,
            ngn_equivalent: ngnEquivalent,
          },
        });

        if (error) throw error;

        if (data.payment_url) {
          const paymentUrl = data.payment_url;
          if (paymentUrl && (paymentUrl.startsWith('https://checkout.flutterwave.com') || paymentUrl.startsWith('https://flutterwave.com'))) {
            window.location.href = paymentUrl;
          } else {
            throw new Error("Invalid payment URL received");
          }
        } else {
          throw new Error("No payment URL received");
        }
      } else {
        const { data, error } = await supabase.functions.invoke("initialize-payment", {
          body: { amount: paystackAmount, redirect_url },
        });

        if (error) throw error;

        if (!data.authorization_url) {
          throw new Error("No checkout URL received");
        }

        const authUrl = data.authorization_url;
        if (authUrl && (authUrl.startsWith('https://checkout.paystack.com') || authUrl.startsWith('https://paystack.com'))) {
          window.location.href = authUrl;
        } else {
          throw new Error("Invalid payment URL received");
        }
        return;
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
                <CardDescription>Enter the amount you want to add (minimum {minAmountDisplay})</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none select-none">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min={minAmount}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ paddingLeft: `${Math.max(currencySymbol.length * 0.75 + 1, 2)}rem` }}
                    className="text-lg h-12"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Quick amount buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                  {[500, 1000, 2000, 5000, 10000].map((quickAmount) => {
                    const selected = amount === quickAmount.toString();
                    return (
                      <Button
                        key={quickAmount}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        onClick={() => setAmount(quickAmount.toString())}
                        disabled={loading}
                        className={`h-12 rounded-xl font-semibold ${selected ? 'bg-gradient-to-br from-primary to-secondary text-white border-0 shadow-md' : 'hover:border-primary'}`}
                      >
                        {currencySymbol}{quickAmount.toLocaleString()}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
                <CardDescription>Select how you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {paymentSections.map((section) => (
                  <div key={section.title} className="space-y-3">
                    <div className="border-b pb-2">
                      <h3 className="font-semibold text-foreground">{section.title}</h3>
                      <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                    </div>
                    <div className="space-y-3">
                      {section.methods.map((method) => {
                        const isMobileMoneyDisabled = method.id === "mobilemoney" && !isMobileMoneySupported;

                        return (
                          <div
                            key={method.id}
                            onClick={() => {
                              if (loading || isMobileMoneyDisabled) return;
                              setSelectedMethod(method.id);
                            }}
                            className={cn(
                              "relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all",
                              isMobileMoneyDisabled
                                ? "border-border opacity-60 cursor-not-allowed"
                                : "cursor-pointer",
                              !isMobileMoneyDisabled && selectedMethod === method.id
                                ? "border-primary bg-primary/5"
                                : !isMobileMoneyDisabled
                                  ? "border-border hover:border-primary/50"
                                  : "",
                              loading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center justify-center w-12 h-12 overflow-hidden shrink-0">
                              {method.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{method.name}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{method.description}</p>

                              {isMobileMoneyDisabled ? (
                                <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                  <p className="text-xs text-destructive">
                                    Mobile Money is only available for: {Object.values(MOBILE_MONEY_CURRENCY_NAMES).join(", ")}. Please change your currency first.
                                  </p>
                                </div>
                              ) : (
                                <p className={cn(
                                  "text-sm font-medium mt-1",
                                  method.feeCalculation(amountNum) === 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                )}>
                                  {method.fee}
                                </p>
                              )}
                            </div>
                            {!isMobileMoneyDisabled && selectedMethod === method.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary absolute top-4 right-4" />
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                      <span className="font-medium">{formatAmount(amountNum)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction fee:</span>
                      <span className={cn(
                        "font-medium",
                        fee === 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                      )}>
                        {fee === 0 ? "Free" : formatAmount(fee)}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-semibold">Total to pay:</span>
                      <span className="font-bold text-lg">{formatAmount(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      {formatAmount(amountNum)} will be added to your balance
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
                <>Pay {formatAmount(total)} with {selectedPaymentMethod.name}</>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
