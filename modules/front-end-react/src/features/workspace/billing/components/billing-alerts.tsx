import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CheckoutState = "verifying" | "confirmed" | "timeout" | "cancelled" | null;

export function CheckoutAlert({ state, onCheckAgain }: { state: CheckoutState; onCheckAgain: () => void }) {
  if (!state) {
    return null;
  }

  if (state === "confirmed") {
    return (
      <Alert variant="success" className="rounded-md">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Payment confirmed. Your subscription is active.</AlertTitle>
      </Alert>
    );
  }

  if (state === "timeout") {
    return (
      <Alert className="rounded-md border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Payment verification is taking longer than expected.</AlertTitle>
        <AlertDescription className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={onCheckAgain}>Check again</Button>
          <Button size="sm" variant="outline">Return to billing</Button>
          <Button size="sm" variant="link" asChild><a href="mailto:support@featbit.co">Contact support</a></Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state === "cancelled") {
    return (
      <Alert className="rounded-md">
        <Info className="h-4 w-4" />
        <AlertTitle>Payment cancelled. Your subscription has not changed.</AlertTitle>
      </Alert>
    );
  }

  return (
    <Alert className="rounded-md">
      <Loader2 className="h-4 w-4 animate-spin" />
      <AlertTitle>Verifying payment...</AlertTitle>
    </Alert>
  );
}

export function UsageAlert({
  percent,
  used,
  purchased,
  exceeded,
  onUpgrade
}: {
  percent: number;
  used: number;
  purchased: number;
  exceeded: boolean;
  onUpgrade: () => void;
}) {
  return (
    <Alert
      className={cn(
        "flex items-center gap-4 rounded-md px-5 py-4",
        exceeded
          ? "border-destructive/60 bg-destructive/5 text-destructive"
          : "border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200"
      )}
    >
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTitle className="mb-0">{exceeded ? "MAU limit exceeded" : "Approaching usage limit"}</AlertTitle>
          <Badge variant="outline" className="bg-background">{percent}% used</Badge>
        </div>
        <AlertDescription className="mt-1 text-muted-foreground">
          You've used {used.toLocaleString()} of {purchased.toLocaleString()} MAU in your current billing period. You may experience limits or overage charges.
        </AlertDescription>
      </div>
      <div className="flex shrink-0 gap-3">
        <Button onClick={onUpgrade}>Upgrade plan</Button>
        <Button variant="outline" asChild><a href="mailto:support@featbit.co">Contact support</a></Button>
      </div>
    </Alert>
  );
}
