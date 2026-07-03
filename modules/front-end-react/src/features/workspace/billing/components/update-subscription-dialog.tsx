import { AlertTriangle, ArrowLeftRight, Calendar, CheckCircle, Clock, CreditCard, Info, Loader2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProrationPreview } from "../billing-api";
import {
  ENTERPRISE_YEARLY_PRICE,
  FINE_GRAINED_ACCESS,
  formatCurrency,
  formatDate,
  planMeta,
  type PendingChange
} from "../billing-utils";
import { FeeRow } from "./billing-display";

const EXTRA_MAU_PER_10K_PER_MONTH_PRICE = 20;
const FINE_GRAINED_ACCESS_PRICE = 60;

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
  const nextPlan = change ? planMeta[change.nextPlan] : undefined;
  const currentPlan = change ? planMeta[change.currentPlan] : undefined;
  const cycle = change?.payload.billingCycle;
  const isYearly = cycle === "yearly" || cycle === "year";
  const billingMultiplier = isYearly ? 12 : 1;
  const includedMau = nextPlan?.includedMau ?? 0;
  const extraMau = change ? Math.max(change.payload.mau - includedMau, 0) : 0;
  const extraMauCost = Math.ceil(extraMau / 10000) * EXTRA_MAU_PER_10K_PER_MONTH_PRICE * billingMultiplier;
  const fineGrainedEnabled = change?.payload.addOnFeatures.includes(FINE_GRAINED_ACCESS) ?? false;
  const fineGrainedCost = fineGrainedEnabled ? FINE_GRAINED_ACCESS_PRICE * billingMultiplier : 0;
  const basePrice = change?.nextPlan === "enterprise" && isYearly ? ENTERPRISE_YEARLY_PRICE : nextPlan?.basePrice ?? 0;
  const summaryTotalLabel = isUpgrade ? t("workspace.billing.dialog.newRecurringTotal") : t("workspace.billing.dialog.nextCycleTotal");
  const transitionHeadline = change?.currentPlan === change?.nextPlan
    ? t("workspace.billing.dialog.configurationChanging")
    : t("workspace.billing.dialog.planTransition", {
      current: currentPlan ? t(currentPlan.nameKey) : "",
      next: nextPlan ? t(nextPlan.nameKey) : ""
    });
  const actionDescription = isUpgrade ? t("workspace.billing.dialog.upgradeActionDescription") : t("workspace.billing.dialog.downgradeActionDescription");
  const notes = getNotes(isUpgrade ?? true, t);
  const prorationLines = getProrationLines(preview);
  const totalDueToday = preview?.immediateCharge?.amount ?? preview?.totalDueToday ?? 0;

  return (
    <Dialog open={Boolean(change)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[56rem] p-0"
        onInteractOutside={(event) => {
          event.stopPropagation();
        }}
      >
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{isUpgrade ? t("workspace.billing.dialog.upgradeTitle") : t("workspace.billing.dialog.downgradeTitle")}</DialogTitle>
          <DialogDescription>{isUpgrade ? t("workspace.billing.dialog.upgradeSubtitle") : t("workspace.billing.dialog.downgradeSubtitle")}</DialogDescription>
        </DialogHeader>

        {change ? (
          <div className="space-y-4 px-6 py-5">
            <section className={cn("rounded-md border p-4", isUpgrade ? "bg-blue-50/40 dark:bg-blue-950/10" : "bg-muted/30")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">{transitionHeadline}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{actionDescription}</p>
                </div>
                <Badge variant={isUpgrade ? "default" : "outline"} className="whitespace-nowrap">{isYearly ? t("workspace.billing.dialog.billedAnnually") : t("workspace.billing.dialog.billedMonthly")}</Badge>
              </div>
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {notes.map((note) => (
                  <li key={note.title} className="rounded-md border bg-background p-3">
                    <div className="flex gap-3">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", isUpgrade ? "bg-blue-50 text-primary" : "bg-muted text-muted-foreground")}>
                        <note.Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{note.title}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{note.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border p-4">
              <div className="mb-4">
                <span className="text-xs font-medium uppercase text-muted-foreground">{t("workspace.billing.dialog.paymentPreview")}</span>
                <h4 className="text-base font-semibold">{t("workspace.billing.dialog.orderSummary")}</h4>
                <p className="text-sm text-muted-foreground">{t("workspace.billing.dialog.orderSummaryDescription")}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-4 border-b pb-4">
                    <div>
                      <span className="text-xs text-muted-foreground">{summaryTotalLabel}</span>
                      <div className="mt-1 text-2xl font-semibold">
                        {formatCurrency(change.nextTotal, "USD", true)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">/ {formatCycle(cycle)}</span>
                      </div>
                    </div>
                    {nextPlan ? <Badge variant="outline">{t(nextPlan.nameKey)}</Badge> : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <SummaryRow label={t("workspace.billing.dialog.basePrice")} value={`${formatCurrency(basePrice, "USD", true)} / ${formatCycle(cycle)}`} />
                    <SummaryRow
                      label={t("workspace.billing.dialog.mau")}
                      sub={extraMau > 0 ? t("workspace.billing.dialog.mauIncludedExtended", { included: includedMau.toLocaleString(), extra: formatMau(extraMau) }) : undefined}
                      value={`${change.payload.mau.toLocaleString()} MAU`}
                      valueSub={extraMau > 0 ? `+${formatCurrency(extraMauCost, "USD", true)} / ${formatCycle(cycle)}` : undefined}
                    />
                    {fineGrainedEnabled ? (
                      <SummaryRow
                        label={t("workspace.billing.drawer.fineGrainedAccess")}
                        value={`+${formatCurrency(fineGrainedCost, "USD", true)} / ${formatCycle(cycle)}`}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <FeeRow label={t("workspace.billing.dialog.currentRecurringTotal")} value={`${formatCurrency(change.currentTotal, "USD", true)} / ${formatCycle(change.currentBillingCycle)}`} />
                    <FeeRow label={summaryTotalLabel} value={`${formatCurrency(change.nextTotal, "USD", true)} / ${formatCycle(cycle)}`} strong />
                    {!isUpgrade ? <FeeRow label={t("workspace.billing.dialog.effectiveAt")} value={formatDate(change.currentPeriodEnd)} strong /> : null}
                  </div>

                  <div className="rounded-md border p-4 text-sm">
                    {isUpgrade ? (
                      previewLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("workspace.billing.dialog.calculating")}</div>
                      ) : previewError ? (
                        <div className="flex gap-3 text-muted-foreground">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <div>
                            <strong className="text-foreground">{t("workspace.billing.dialog.prorationUnavailableTitle")}</strong>
                            <p>{t("workspace.billing.errors.proration")}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <strong>{t("workspace.billing.dialog.proratedCharge")}</strong>
                          {prorationLines.map((line) => (
                            <FeeRow
                              key={`${line.label}-${line.amount}-${line.type}`}
                              label={line.label}
                              value={`${line.type === "credit" ? "-" : ""}${formatCurrency(Math.abs(line.amount) / 100, preview?.currency ?? "USD")}`}
                            />
                          ))}
                          <div className="border-t pt-2">
                            <FeeRow label={t("workspace.billing.dialog.totalDueToday")} value={formatCurrency(totalDueToday / 100, preview?.currency ?? "USD")} strong />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex gap-3 text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <strong className="text-foreground">{t("workspace.billing.dialog.noPaymentTodayTitle")}</strong>
                          <p>{t("workspace.billing.dialog.noPaymentTodayDescription")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" disabled={updating} onClick={() => onOpenChange(false)}>{t("workspace.billing.actions.maybeLater")}</Button>
          <Button variant={isUpgrade ? "default" : "destructive"} disabled={updating || (isUpgrade && previewLoading)} onClick={onConfirm}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isUpgrade ? t("workspace.billing.actions.confirmUpgrade") : t("workspace.billing.actions.scheduleDowngrade")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, sub, value, valueSub }: { label: string; sub?: string; value: string; valueSub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <div>{label}</div>
        {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      <div className="text-right">
        <div className="font-medium">{value}</div>
        {valueSub ? <div className="mt-0.5 text-xs text-muted-foreground">{valueSub}</div> : null}
      </div>
    </div>
  );
}

function getProrationLines(preview?: ProrationPreview) {
  if (preview?.immediateCharge?.displayLines?.length) {
    return preview.immediateCharge.displayLines.map((line) => ({
      label: line.label ?? "",
      amount: line.amount ?? 0,
      type: line.type ?? "charge"
    }));
  }

  return [
    { label: "Credit", amount: preview?.creditAmount ?? 0, type: "credit" },
    { label: "Charge", amount: preview?.chargeAmount ?? 0, type: "charge" }
  ].filter((line) => line.amount !== 0);
}

function getNotes(isUpgrade: boolean, t: ReturnType<typeof useTranslation>["t"]) {
  if (isUpgrade) {
    return [
      { Icon: Zap, title: t("workspace.billing.dialog.upgradeNoteLimitsTitle"), description: t("workspace.billing.dialog.upgradeNoteLimitsDescription") },
      { Icon: CreditCard, title: t("workspace.billing.dialog.upgradeNoteProrationTitle"), description: t("workspace.billing.dialog.upgradeNoteProrationDescription") },
      { Icon: Calendar, title: t("workspace.billing.dialog.upgradeNoteRecurringTitle"), description: t("workspace.billing.dialog.upgradeNoteRecurringDescription") }
    ];
  }

  return [
    { Icon: Clock, title: t("workspace.billing.dialog.downgradeNoteTimingTitle"), description: t("workspace.billing.dialog.downgradeNoteTimingDescription") },
    { Icon: ArrowLeftRight, title: t("workspace.billing.dialog.downgradeNotePriceTitle"), description: t("workspace.billing.dialog.downgradeNotePriceDescription") },
    { Icon: CheckCircle, title: t("workspace.billing.dialog.downgradeNoteReviewTitle"), description: t("workspace.billing.dialog.downgradeNoteReviewDescription") }
  ];
}

function formatCycle(cycle?: string) {
  return cycle === "yearly" || cycle === "year" ? "year" : "month";
}

function formatMau(value: number) {
  return value >= 1000 ? `${value / 1000}K MAU` : `${value} MAU`;
}
