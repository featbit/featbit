import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProrationPreview } from "../billing-api";
import { FINE_GRAINED_ACCESS, formatCurrency, type PendingChange } from "../billing-utils";
import { FeeRow } from "./billing-display";

export function UpdateSubscriptionDialog({
  change,
  preview,
  previewLoading,
  previewError,
  updating,
  onOpenChange,
  onConfirm
}: {
  change: PendingChange | null;
  preview?: ProrationPreview;
  previewLoading: boolean;
  previewError: boolean;
  updating: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isUpgrade = change?.kind === "upgrade";
  return (
    <Dialog open={Boolean(change)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{isUpgrade ? "Upgrade subscription" : "Downgrade subscription"}</DialogTitle>
          <DialogDescription>{isUpgrade ? "Your plan configuration is changing" : "Current access remains until renewal."}</DialogDescription>
        </DialogHeader>
        {change ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border p-4">
              <FeeRow label="New recurring total" value={`$${change.nextTotal}/month`} strong />
              <FeeRow label="Current recurring total" value={`$${change.currentTotal}/month`} />
              <FeeRow label="Selected MAU" value={change.payload.mau.toLocaleString()} />
              {change.payload.addOnFeatures.includes(FINE_GRAINED_ACCESS) ? <FeeRow label="Fine-grained Access Control" value="Included" /> : null}
            </div>
            {isUpgrade ? (
              <div className="rounded-md border p-4 text-sm">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculating your prorated charge...</div>
                ) : previewError ? (
                  <p className="text-muted-foreground">Unable to load proration preview. You will see the exact charge at checkout.</p>
                ) : (
                  <>
                    <FeeRow label="Credit" value={formatCurrency((preview?.creditAmount ?? 0) / 100, preview?.currency ?? "USD")} />
                    <FeeRow label="Charge" value={formatCurrency((preview?.chargeAmount ?? 0) / 100, preview?.currency ?? "USD")} />
                    <FeeRow label="Total due today" value={formatCurrency((preview?.totalDueToday ?? 0) / 100, preview?.currency ?? "USD")} strong />
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" disabled={updating} onClick={() => onOpenChange(false)}>Maybe later</Button>
          <Button variant={isUpgrade ? "default" : "secondary"} disabled={updating} onClick={onConfirm}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isUpgrade ? "Confirm upgrade" : "Schedule downgrade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
