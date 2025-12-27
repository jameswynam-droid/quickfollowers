import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNoIndex } from "@/hooks/useNoIndex";

const PaymentFailed = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reference = params.get("reference");

  const [seconds, setSeconds] = useState(4);

  const previousTitle = useMemo(() => document.title, []);

  useEffect(() => {
    document.title = "Payment Failed | QuickFollowers";
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
              <XCircle className="h-5 w-5 text-destructive" />
              Payment failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We couldn’t confirm your payment. Please try again.
              {reference ? ` Reference: ${reference}` : ""}
            </p>

            <div className="text-sm">
              Redirecting to your dashboard in <span className="font-semibold">{Math.max(seconds, 0)}</span>…
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => navigate("/dashboard", { replace: true })}>
                Back to Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard", { replace: true })}>
                Add Funds
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default PaymentFailed;
