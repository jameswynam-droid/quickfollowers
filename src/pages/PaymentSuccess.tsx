import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNoIndex } from "@/hooks/useNoIndex";

const PaymentSuccess = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reference = params.get("reference");

  const [seconds, setSeconds] = useState(3);

  const previousTitle = useMemo(() => document.title, []);

  useEffect(() => {
    document.title = "Payment Successful | QuickFollowers";
    return () => {
      document.title = previousTitle;
    };
  }, [previousTitle]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((s) => s - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (seconds <= 0) {
      navigate("/dashboard", { replace: true });
    }
  }, [seconds, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <section className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Payment confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your wallet has been funded successfully.
              {reference ? ` Reference: ${reference}` : ""}
            </p>

            <div className="text-sm">
              Redirecting to your dashboard in <span className="font-semibold">{Math.max(seconds, 0)}</span>…
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => navigate("/dashboard", { replace: true })}>
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate("/transactions", { replace: true })}>
                Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default PaymentSuccess;
