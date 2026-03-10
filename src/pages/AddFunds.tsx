import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, CreditCard, Smartphone, Building2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { CurrencyCode } from "@/hooks/currencyData";
import flutterwaveLogo from "@/assets/flutterwave-logo.png";
import paystackLogo from "@/assets/paystack-logo.png";

type PaymentMethod = "paystack" | "flutterwave_card" | "mobilemoney";

const MOBILE_MONEY_CURRENCIES: Record<string, string> = {
  GHS: "GHS", KES: "KES", UGX: "UGX", RWF: "RWF",
  ZMW: "ZMW", XOF: "XOF", TZS: "TZS", MWK: "MWK",
};

const MOBILE_MONEY_CURRENCY_NAMES: Record<string, string> = {
  GHS: "Ghana (GHS)", KES: "Kenya (KES)", UGX: "Uganda (UGX)",
  RWF: "Rwanda (RWF)", ZMW: "Zambia (ZMW)", XOF: "West Africa CFA (XOF)",
  TZS: "Tanzania (TZS)", MWK: "Malawi (MWK)",
};

const MOBILE_MONEY_NETWORKS: Record<string, string[]> = {
  GHS: ["MTN", "VODAFONE", "TIGO"],
  KES: ["MPESA"],
  UGX: ["MTN", "AIRTEL"],
  RWF: ["MTN", "AIRTEL"],
  ZMW: ["MTN", "AIRTEL"],
  XOF: ["MTN", "ORANGE", "MOOV"],
  TZS: ["VODACOM", "TIGO", "AIRTEL"],
  MWK: ["AIRTEL", "TNM"],
};

const COUNTRY_CODES: Record<string, string> = {
  GHS: "233", KES: "254", UGX: "256", RWF: "250",
  ZMW: "260", XOF: "225", TZS: "255", MWK: "265",
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
        id: "flutterwave_card",
        name: "Card Payment",
        description: "Pay with debit or credit card (Visa, Mastercard)",
        fee: "No fees",
        feeCalculation: () => 0,
        icon: <CreditCard className="w-8 h-8 text-primary" />,
      },
      {
        id: "mobilemoney",
        name: "Mobile Money",
        description: "Pay with MPesa, MTN, Airtel & other mobile wallets",
        fee: "No fees",
        feeCalculation: () => 0,
        icon: <Smartphone className="w-8 h-8 text-primary" />,
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
          return Math.min(percentageFee + fixedFee, 2000);
        },
        icon: <img src={paystackLogo} alt="Paystack" className="w-10 h-10 object-contain" width="40" height="40" loading="eager" decoding="async" />,
      },
    ],
  },
];

const allPaymentMethods = paymentSections.flatMap(s => s.methods);

type AuthStep = null | "pin" | "otp" | "redirect" | "instruction" | "processing" | "polling";

export default function AddFunds() {
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("flutterwave_card");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currency, currencySymbol, convertFromNGN, convertToNGN } = useCurrency();

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  // Mobile money fields
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");

  // Authorization state
  const [authStep, setAuthStep] = useState<AuthStep>(null);
  const [chargeId, setChargeId] = useState("");
  const [chargeReference, setChargeReference] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [paymentInstruction, setPaymentInstruction] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const isMobileMoneySupported = currency in MOBILE_MONEY_CURRENCIES;

  useEffect(() => {
    if (selectedMethod === "mobilemoney" && !isMobileMoneySupported) {
      setSelectedMethod("flutterwave_card");
    }
  }, [currency, isMobileMoneySupported, selectedMethod]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  const amountNum = parseFloat(amount) || 0;
  const selectedPaymentMethod = allPaymentMethods.find(m => m.id === selectedMethod)!;
  const fee = selectedPaymentMethod.feeCalculation(amountNum);
  const total = amountNum + fee;

  const MIN_NGN = currency === "NGN" ? 100 : 500;
  const minAmount = Math.ceil(convertFromNGN(MIN_NGN));
  const minAmountDisplay = `${currencySymbol}${minAmount.toLocaleString()}`;

  const formatAmount = (val: number) =>
    `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  // Handle V4 charge response
  const handleChargeResponse = async (data: any) => {
    setChargeId(data.charge_id);
    setChargeReference(data.reference);

    if (data.status === "succeeded") {
      // Payment completed immediately
      navigate("/payment/success?reference=" + encodeURIComponent(data.reference));
      return;
    }

    const nextAction = data.next_action;
    if (!nextAction) {
      // No next action but not succeeded - poll for status
      setAuthStep("polling");
      setAuthDialogOpen(true);
      pollChargeStatus(data.charge_id, data.reference);
      return;
    }

    switch (nextAction.type) {
      case "redirect_url":
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        }
        break;
      case "requires_pin":
        setAuthStep("pin");
        setAuthDialogOpen(true);
        break;
      case "requires_otp":
        setAuthStep("otp");
        setAuthDialogOpen(true);
        break;
      case "payment_instruction":
        setPaymentInstruction(data.payment_instruction || nextAction.payment_instruction?.note || "Complete payment on your device");
        setAuthStep("instruction");
        setAuthDialogOpen(true);
        pollChargeStatus(data.charge_id, data.reference);
        break;
      case "requires_additional_fields":
        // AVS - for now, show a message
        toast({
          title: "Additional verification required",
          description: "This card requires address verification. Please try a different card or payment method.",
          variant: "destructive",
        });
        setLoading(false);
        break;
      default:
        toast({
          title: "Unknown authorization required",
          description: "Please try a different payment method.",
          variant: "destructive",
        });
        setLoading(false);
    }
  };

  // Poll charge status for async payments
  const pollChargeStatus = async (cId: string, ref: string, attempts = 0) => {
    if (attempts > 30) { // 5 minutes max
      toast({
        title: "Payment Timeout",
        description: "Payment verification timed out. Check your transactions page for updates.",
        variant: "destructive",
      });
      setAuthDialogOpen(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("verify-flutterwave", {
        body: { charge_id: cId, reference: ref },
      });

      if (error) throw error;

      if (data.status === "success") {
        setAuthDialogOpen(false);
        navigate("/payment/success?reference=" + encodeURIComponent(ref));
        return;
      }

      if (data.status === "failed") {
        setAuthDialogOpen(false);
        navigate("/payment/failed?reference=" + encodeURIComponent(ref) + "&reason=" + (data.reason || "failed"));
        return;
      }

      // Still pending - poll again in 10 seconds
      setTimeout(() => pollChargeStatus(cId, ref, attempts + 1), 10000);
    } catch (err) {
      console.error("Poll error:", err);
      setTimeout(() => pollChargeStatus(cId, ref, attempts + 1), 10000);
    }
  };

  // Submit authorization (PIN/OTP)
  const handleAuthorize = async () => {
    setAuthStep("processing");

    try {
      const body: any = { charge_id: chargeId };

      if (pinValue) {
        body.authorization_type = "pin";
        body.pin = pinValue;
      } else if (otpValue) {
        body.authorization_type = "otp";
        body.otp = otpValue;
      }

      const { data, error } = await supabase.functions.invoke("authorize-flutterwave", { body });
      if (error) throw error;

      // Handle the authorize response (may need another step)
      if (data.status === "succeeded") {
        // Verify and credit balance
        setAuthStep("polling");
        pollChargeStatus(chargeId, chargeReference);
      } else if (data.next_action) {
        // Another authorization step needed
        if (data.next_action.type === "requires_otp") {
          setPinValue("");
          setOtpValue("");
          setAuthStep("otp");
        } else if (data.next_action.type === "redirect_url" && data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          setAuthStep("polling");
          pollChargeStatus(chargeId, chargeReference);
        }
      } else {
        // Unknown state - poll
        setAuthStep("polling");
        pollChargeStatus(chargeId, chargeReference);
      }
    } catch (error: any) {
      toast({
        title: "Authorization Failed",
        description: error.message || "Failed to authorize payment.",
        variant: "destructive",
      });
      setAuthDialogOpen(false);
      setLoading(false);
    }
  };

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

    setLoading(true);

    try {
      const redirect_url = window.location.origin;
      const paystackAmount = Number(convertToNGN(amountNum).toFixed(2));

      if (selectedMethod === "flutterwave_card") {
        // Validate card fields
        const cleanCardNumber = cardNumber.replace(/\s/g, "");
        if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
          throw new Error("Please enter a valid card number");
        }
        if (!expiryMonth || !expiryYear || !cvv) {
          throw new Error("Please fill in all card details");
        }

        const checkoutCurrency = currency === "NGN" ? "NGN" : currency;
        const ngnEquivalent = Number(convertToNGN(amountNum).toFixed(2));

        const { data, error } = await supabase.functions.invoke("initialize-flutterwave", {
          body: {
            amount: amountNum,
            redirect_url,
            payment_type: "card",
            currency: checkoutCurrency,
            ngn_equivalent: ngnEquivalent,
            card_number: cleanCardNumber,
            expiry_month: expiryMonth,
            expiry_year: expiryYear,
            cvv,
          },
        });

        if (error) throw error;
        await handleChargeResponse(data);
      } else if (selectedMethod === "mobilemoney") {
        if (!phoneNumber || !selectedNetwork) {
          throw new Error("Please enter your phone number and select a network");
        }

        const checkoutCurrency = MOBILE_MONEY_CURRENCIES[currency];
        const ngnEquivalent = Number(convertToNGN(amountNum).toFixed(2));
        const phoneCountryCode = COUNTRY_CODES[currency] || "234";

        const { data, error } = await supabase.functions.invoke("initialize-flutterwave", {
          body: {
            amount: amountNum,
            redirect_url,
            payment_type: "mobilemoney",
            currency: checkoutCurrency,
            ngn_equivalent: ngnEquivalent,
            phone_number: phoneNumber,
            phone_country_code: phoneCountryCode,
            network: selectedNetwork,
          },
        });

        if (error) throw error;
        await handleChargeResponse(data);
      } else {
        // Paystack
        const { data, error } = await supabase.functions.invoke("initialize-payment", {
          body: { amount: paystackAmount, redirect_url },
        });
        if (error) throw error;
        if (!data.authorization_url) throw new Error("No checkout URL received");
        window.location.href = data.authorization_url;
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

  const availableNetworks = MOBILE_MONEY_NETWORKS[currency] || [];

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
            <p className="text-muted-foreground">Choose your preferred payment method and enter the amount</p>
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
                <div className="flex flex-wrap gap-2 mt-4">
                  {[500, 1000, 2000, 5000, 10000].map((quickAmount) => (
                    <Button key={quickAmount} type="button" variant="outline" size="sm" onClick={() => setAmount(quickAmount.toString())} disabled={loading}>
                      {currencySymbol}{quickAmount.toLocaleString()}
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
                            onClick={() => { if (!loading && !isMobileMoneyDisabled) setSelectedMethod(method.id); }}
                            className={cn(
                              "relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all",
                              isMobileMoneyDisabled ? "border-border opacity-60 cursor-not-allowed" : "cursor-pointer",
                              !isMobileMoneyDisabled && selectedMethod === method.id ? "border-primary bg-primary/5" : !isMobileMoneyDisabled ? "border-border hover:border-primary/50" : "",
                              loading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg overflow-hidden">
                              {method.icon}
                            </div>
                            <div className="flex-1">
                              <span className="font-semibold text-foreground">{method.name}</span>
                              <p className="text-sm text-muted-foreground mt-0.5">{method.description}</p>
                              {isMobileMoneyDisabled ? (
                                <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                  <p className="text-xs text-destructive">
                                    Mobile Money is only available for: {Object.values(MOBILE_MONEY_CURRENCY_NAMES).join(", ")}.
                                  </p>
                                </div>
                              ) : (
                                <p className={cn("text-sm font-medium mt-1", method.feeCalculation(amountNum) === 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400")}>
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

                {/* Powered by Flutterwave badge for card/mobile money */}
                {(selectedMethod === "flutterwave_card" || selectedMethod === "mobilemoney") && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                    <span>Powered by</span>
                    <img src={flutterwaveLogo} alt="Flutterwave" className="h-5 object-contain" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Details Form */}
            {selectedMethod === "flutterwave_card" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Card Details
                  </CardTitle>
                  <CardDescription>Enter your debit or credit card information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input
                      id="card-number"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      disabled={loading}
                      required
                      autoComplete="cc-number"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="expiry-month">Month</Label>
                      <Input
                        id="expiry-month"
                        placeholder="MM"
                        value={expiryMonth}
                        onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                        maxLength={2}
                        disabled={loading}
                        required
                        autoComplete="cc-exp-month"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry-year">Year</Label>
                      <Input
                        id="expiry-year"
                        placeholder="YY"
                        value={expiryYear}
                        onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                        maxLength={2}
                        disabled={loading}
                        required
                        autoComplete="cc-exp-year"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        type="password"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        disabled={loading}
                        required
                        autoComplete="cc-csc"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Your card details are encrypted and processed securely
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Mobile Money Form */}
            {selectedMethod === "mobilemoney" && isMobileMoneySupported && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Mobile Money Details
                  </CardTitle>
                  <CardDescription>Enter your mobile money information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="network">Network</Label>
                    <select
                      id="network"
                      value={selectedNetwork}
                      onChange={(e) => setSelectedNetwork(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={loading}
                      required
                    >
                      <option value="">Select network</option>
                      {availableNetworks.map((net) => (
                        <option key={net} value={net}>{net}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground border border-input">
                        +{COUNTRY_CODES[currency] || "234"}
                      </span>
                      <Input
                        id="phone"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      <span className={cn("font-medium", fee === 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400")}>
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

            {/* Submit */}
            <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={loading || !amountNum}>
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</>
              ) : (
                <>Pay {formatAmount(total)} with {selectedPaymentMethod.name}</>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />

      {/* Authorization Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={(open) => {
        if (!open && authStep !== "processing" && authStep !== "polling") {
          setAuthDialogOpen(false);
          setLoading(false);
          setAuthStep(null);
          setPinValue("");
          setOtpValue("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {authStep === "pin" && (
            <>
              <DialogHeader>
                <DialogTitle>Enter Card PIN</DialogTitle>
                <DialogDescription>
                  Enter your card PIN to authorize this payment
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="password"
                  placeholder="Enter PIN"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  autoFocus
                />
                <Button onClick={handleAuthorize} className="w-full" disabled={!pinValue}>
                  Authorize Payment
                </Button>
              </div>
            </>
          )}

          {authStep === "otp" && (
            <>
              <DialogHeader>
                <DialogTitle>Enter OTP</DialogTitle>
                <DialogDescription>
                  Enter the one-time password sent to your phone/email
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter OTP"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                  maxLength={8}
                  autoFocus
                />
                <Button onClick={handleAuthorize} className="w-full" disabled={!otpValue}>
                  Verify OTP
                </Button>
              </div>
            </>
          )}

          {authStep === "instruction" && (
            <>
              <DialogHeader>
                <DialogTitle>Complete Payment</DialogTitle>
                <DialogDescription>
                  Follow the instructions below to complete your payment
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted text-sm">
                  {paymentInstruction}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for payment confirmation...
                </div>
              </div>
            </>
          )}

          {(authStep === "processing" || authStep === "polling") && (
            <>
              <DialogHeader>
                <DialogTitle>{authStep === "processing" ? "Authorizing..." : "Verifying Payment..."}</DialogTitle>
                <DialogDescription>
                  Please wait while we process your payment
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">This may take a moment...</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
