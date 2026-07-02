import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const isUpgrade = change?.kind === "upgrade";
  return (
    <Dialog open={Boolean(change)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{isUpgrade ? t("workspace.billing.dialog.upgradeTitle") : t("workspace.billing.dialog.downgradeTitle")}</DialogTitle>
          <DialogDescription>{isUpgrade ? t("workspace.billing.dialog.upgradeDescription") : t("workspace.billing.dialog.downgradeDescription")}</DialogDescription>
        </DialogHeader>
        {change ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border p-4">
              <FeeRow label={t("workspace.billing.dialog.newRecurringTotal")} value={t("workspace.billing.overview.perMonth", { amount: `$${change.nextTotal}` })} strong />
              <FeeRow label={t("workspace.billing.dialog.currentRecurringTotal")} value={t("workspace.billing.overview.perMonth", { amount: `$${change.currentTotal}` })} />
              <FeeRow label={t("workspace.billing.dialog.selectedMau")} value={change.payload.mau.toLocaleString()} />
              {change.payload.addOnFeatures.includes(FINE_GRAINED_ACCESS) ? <FeeRow label={t("workspace.billing.drawer.fineGrainedAccess")} value={t("workspace.billing.dialog.included")} /> : null}
            </div>
            {isUpgrade ? (
              <div className="rounded-md border p-4 text-sm">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("workspace.billing.dialog.calculating")}</div>
                ) : previewError ? (
                  <p className="text-muted-foreground">{t("workspace.billing.errors.proration")}</p>
                ) : (
                  <>
                    <FeeRow label={t("workspace.billing.dialog.credit")} value={formatCurrency((preview?.creditAmount ?? 0) / 100, preview?.currency ?? "USD")} />
                    <FeeRow label={t("workspace.billing.dialog.charge")} value={formatCurrency((preview?.chargeAmount ?? 0) / 100, preview?.currency ?? "USD")} />
                    <FeeRow label={t("workspace.billing.dialog.totalDueToday")} value={formatCurrency((preview?.totalDueToday ?? 0) / 100, preview?.currency ?? "USD")} strong />
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" disabled={updating} onClick={() => onOpenChange(false)}>{t("workspace.billing.actions.maybeLater")}</Button>
          <Button variant={isUpgrade ? "default" : "secondary"} disabled={updating} onClick={onConfirm}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isUpgrade ? t("workspace.billing.actions.confirmUpgrade") : t("workspace.billing.actions.scheduleDowngrade")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
