import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_HINT } from "@/lib/providerHint";

// Admin-only legend that maps the subtle "P-XX" badge shown next to
// each order back to the real upstream provider name — so admins know
// where to open a support ticket without exposing the vendor in the UI.
const ProviderLegend = () => {
  const rows = PROVIDER_HINT.legend();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Provider hint legend</CardTitle>
        <p className="text-xs text-muted-foreground">
          Each order in User Lookup shows a small code (e.g. <span className="font-mono">P-04</span>).
          Match it here to know which upstream provider handled the order and where to escalate.
          Only visible to admins.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center justify-between rounded-md border px-3 py-2">
              <Badge variant="outline" className="font-mono text-xs">{r.code}</Badge>
              <span className="text-sm font-medium text-foreground">{r.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProviderLegend;
