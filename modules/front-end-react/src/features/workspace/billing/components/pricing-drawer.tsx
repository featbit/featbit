import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { BillingCycle, BillingSubscription, SubscriptionChangePayload } from "../billing-api";
import {
  FINE_GRAINED_ACCESS,
  currentTotal,
  formatDate,
  formatMoneyPerCycle,
  normalizePlan,
  planMeta,
  planRank,
  planTotal,
  type DrawerIntent,
  type PlanKey,
  type UsageStats
} from "../billing-utils";
import { FeeLine, PeriodItem } from "./billing-display";

export function PricingDrawer({
  open,
  intent,
  subscription,
  stats,
  onOpenChange,
  onStartChange
}: {
  open: boolean;
  intent: DrawerIntent;
  subscription?: BillingSubscription;
  stats: UsageStats;
  onOpenChange: (open: boolean) => void;
  onStartChange: (payload: SubscriptionChangePayload) => void;
}) {
  const { t } = useTranslation();
  const currentPlan = normalizePlan(subscription?.plan);
  const [selectedMau, setSelectedMau] = useState(subscription?.mau ?? planMeta[currentPlan].includedMau);
  const [fineGrained, setFineGrained] = useState(subscription?.addOnFeatures?.includes(FINE_GRAINED_ACCESS) ?? false);
  const billingCycle = subscription?.billingCycle ?? "monthly";

  const title = intent === "upgrade" ? t("workspace.billing.drawer.upgradeTitle") : t("workspace.billing.drawer.manageTitle");
  const description = intent === "upgrade"
    ? t("workspace.billing.drawer.upgradeDescription")
    : t("workspace.billing.drawer.manageDescription");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[58rem]">
        <div className="border-b px-6 py-5">
          <SheetHeader>
            <div className="flex items-start justify-between gap-4 pr-12">
              <div>
                <SheetTitle className="text-2xl">{title}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </div>
              {intent === "upgrade" ? (
                <Button variant="outline" asChild><a href="mailto:support@featbit.co">{t("workspace.billing.actions.contactSupport")}</a></Button>
              ) : null}
            </div>
          </SheetHeader>
        </div>
        <div className="space-y-4 p-6">
          {intent === "upgrade" ? (
            <div className="flex items-center justify-between rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
              <div>
                <div className="font-semibold">{t("workspace.billing.drawer.approachingLimit")}</div>
                <div className="text-sm">{t("workspace.billing.drawer.currentCapacity", { used: stats.used.toLocaleString(), purchased: stats.purchased.toLocaleString(), percent: stats.percent })}</div>
              </div>
              <Badge variant="outline" className="bg-background">{t("workspace.billing.overview.remaining", { remaining: stats.remaining.toLocaleString() })}</Badge>
            </div>
          ) : (
            <div className="grid rounded-md border md:grid-cols-4">
              <PeriodItem label={t("workspace.billing.drawer.currentPlanSummary")} value={`${t(planMeta[currentPlan].nameKey)} - ${billingCycle === "yearly" ? t("workspace.billing.drawer.yearly") : t("workspace.billing.drawer.monthly")}`} />
              <PeriodItem label={t("workspace.billing.drawer.mauCapacity")} value={(subscription?.mau ?? planMeta[currentPlan].includedMau).toLocaleString()} />
              <PeriodItem label={t("workspace.billing.overview.nextCharge")} value={formatDate(subscription?.currentPeriodEnd)} />
              <PeriodItem label={t("workspace.billing.drawer.currentTotal")} value={t("workspace.billing.overview.perMonth", { amount: `$${currentTotal(subscription)}` })} />
            </div>
          )}

          {intent === "upgrade" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <RecommendationCard
                label={t("workspace.billing.drawer.fastestFix")}
                title={t("workspace.billing.drawer.addCapacity", { plan: t(planMeta[currentPlan].nameKey) })}
                description={t("workspace.billing.drawer.addCapacityDescription")}
                selectedMau={selectedMau}
                setSelectedMau={setSelectedMau}
                fineGrained={fineGrained}
                setFineGrained={setFineGrained}
                actionLabel={t("workspace.billing.actions.updatePlan")}
                highlighted
                onAction={() => onStartChange({ plan: currentPlan, billingCycle, mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] })}
              />
              <EnterpriseRecommendation onAction={() => onStartChange({ plan: "enterprise", billingCycle, mau: 80000, addOnFeatures: [FINE_GRAINED_ACCESS] })} />
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                {(["free", "pro", "growth"] as const).map((key) => (
                  <PlanCard
                    key={key}
                    planKey={key}
                    currentPlan={currentPlan}
                    billingCycle={billingCycle}
                    selectedMau={key === currentPlan ? selectedMau : planMeta[key].includedMau}
                    fineGrained={key === currentPlan ? fineGrained : false}
                    onMauChange={setSelectedMau}
                    onFineGrainedChange={setFineGrained}
                    onAction={(payload) => onStartChange(payload)}
                  />
                ))}
              </div>
              <EnterpriseRow currentPlan={currentPlan} billingCycle={billingCycle} onAction={(payload) => onStartChange(payload)} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PlanCard({
  planKey,
  currentPlan,
  billingCycle,
  selectedMau,
  fineGrained,
  onMauChange,
  onFineGrainedChange,
  onAction
}: {
  planKey: PlanKey;
  currentPlan: PlanKey;
  billingCycle: BillingCycle;
  selectedMau: number;
  fineGrained: boolean;
  onMauChange: (mau: number) => void;
  onFineGrainedChange: (checked: boolean) => void;
  onAction: (payload: SubscriptionChangePayload) => void;
}) {
  const meta = planMeta[planKey];
  const { t } = useTranslation();
  const isCurrent = planKey === currentPlan;
  const changed = isCurrent && (selectedMau !== meta.includedMau || fineGrained);
  const actionLabel = isCurrent
    ? (changed ? t("workspace.billing.actions.updatePlan") : t("workspace.billing.actions.currentPlan"))
    : planRank(planKey) > planRank(currentPlan)
      ? t("workspace.billing.actions.upgradeTo", { plan: t(meta.nameKey) })
      : t("workspace.billing.actions.downgradeTo", { plan: t(meta.nameKey) });

  return (
    <Card className={cn("flex min-h-72 flex-col rounded-md p-4 shadow-none", isCurrent && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20")}>
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{t(meta.nameKey)}</h3>
        {isCurrent ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("workspace.billing.actions.currentPlan")}</Badge> : null}
      </div>
      <p className="mt-2 min-h-10 text-sm text-muted-foreground">{t(meta.descriptionKey)}</p>
      <div className="mt-6 text-2xl font-semibold">{formatMoneyPerCycle(isCurrent ? planTotal({ plan: planKey, billingCycle, mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] }) : meta.monthlyPrice, billingCycle)}</div>
      <div className="mt-5 h-2 rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-blue-600" />
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>- {planKey === "free" ? t("workspace.billing.drawer.mauPlain", { mau: meta.includedMau.toLocaleString() }) : t("workspace.billing.drawer.includedMau", { mau: meta.includedMau.toLocaleString() })}</p>
        <p>- {planKey === "free" ? t("workspace.billing.drawer.communitySupport") : t("workspace.billing.drawer.prioritySupport")}</p>
        {isCurrent && planKey !== "free" ? (
          <>
            <Label className="mt-3 block text-foreground">{t("workspace.billing.drawer.selectedMau")}</Label>
            <Input type="range" min={meta.includedMau} max={300000} step={10000} value={selectedMau} onChange={(event) => onMauChange(Number(event.target.value))} />
            <label className="flex items-center gap-2 text-foreground">
              <Checkbox checked={fineGrained} onCheckedChange={(checked) => onFineGrainedChange(checked === true)} />
              {t("workspace.billing.drawer.fineGrainedAccess")}
            </label>
          </>
        ) : null}
      </div>
      <Button className="mt-auto" variant={isCurrent || planRank(planKey) > planRank(currentPlan) ? "default" : "outline"} disabled={isCurrent && !changed} onClick={() => onAction({ plan: planKey, billingCycle, mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] })}>
        {actionLabel}
      </Button>
    </Card>
  );
}

function EnterpriseRow({ currentPlan, billingCycle, onAction }: { currentPlan: PlanKey; billingCycle: BillingCycle; onAction: (payload: SubscriptionChangePayload) => void }) {
  const { t } = useTranslation();

  return (
    <Card className="grid gap-4 rounded-md p-4 shadow-none lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
      <div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("workspace.billing.drawer.recommended")}</Badge>
        <h3 className="mt-3 text-xl font-semibold">{t(planMeta.enterprise.nameKey)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t(planMeta.enterprise.descriptionKey)}</p>
        <div className="mt-3 inline-flex overflow-hidden rounded-md border">
          <span className="bg-primary px-3 py-1.5 text-xs text-primary-foreground">{t("workspace.billing.drawer.monthly")}</span>
          <span className="px-3 py-1.5 text-xs">{t("workspace.billing.drawer.yearly")}</span>
        </div>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="h-2 rounded-full bg-muted"><div className="h-full w-2/3 rounded-full bg-blue-600" /></div>
        <p>{t("workspace.billing.drawer.enterpriseSummary")}</p>
        <p>- {t("workspace.billing.drawer.dedicatedOnboarding")}</p>
        <p>- {t("workspace.billing.drawer.advancedGovernance")}</p>
      </div>
      <Button onClick={() => onAction({ plan: "enterprise", billingCycle, mau: 80000, addOnFeatures: [FINE_GRAINED_ACCESS] })}>
        {planRank("enterprise") > planRank(currentPlan) ? t("workspace.billing.drawer.upgradeEnterprise") : t("workspace.billing.actions.currentPlan")}
      </Button>
    </Card>
  );
}

function RecommendationCard({
  label,
  title,
  description,
  selectedMau,
  setSelectedMau,
  fineGrained,
  setFineGrained,
  actionLabel,
  highlighted,
  onAction
}: {
  label: string;
  title: string;
  description: string;
  selectedMau: number;
  setSelectedMau: (mau: number) => void;
  fineGrained: boolean;
  setFineGrained: (checked: boolean) => void;
  actionLabel: string;
  highlighted?: boolean;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const total = planTotal({ plan: "growth", billingCycle: "monthly", mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] });
  return (
    <Card className={cn("rounded-md p-4 shadow-none", highlighted && "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20")}>
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{label}</Badge>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm text-muted-foreground">{t("workspace.billing.drawer.selectedMau")}</p>
      <div className="text-3xl font-semibold">{selectedMau.toLocaleString()}</div>
      <Input className="mt-3" type="range" min={40000} max={300000} step={10000} value={selectedMau} onChange={(event) => setSelectedMau(Number(event.target.value))} />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{t("workspace.billing.drawer.includedMau", { mau: "40K" })}</span><span>+{Math.max(selectedMau - 40000, 0) / 1000}K {t("workspace.billing.drawer.extendedMau")}</span></div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine label={t("workspace.billing.drawer.growthBase")} value={t("workspace.billing.overview.perMonth", { amount: "$149" })} />
        <FeeLine label={t("workspace.billing.drawer.extendedMau")} value={t("workspace.billing.overview.plusPerMonth", { amount: `$${Math.max((selectedMau - 40000) / 10000, 0) * 20}` })} />
        <FeeLine label={t("workspace.billing.overview.fineGrained")} value={fineGrained ? t("workspace.billing.overview.plusPerMonth", { amount: "$60" }) : t("workspace.billing.overview.perMonth", { amount: "$0" })} />
        <FeeLine label={t("workspace.billing.drawer.projectedTotal")} value={t("workspace.billing.overview.perMonth", { amount: `$${total}` })} strong />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox checked={fineGrained} onCheckedChange={(checked) => setFineGrained(checked === true)} />
        {t("workspace.billing.drawer.fineGrainedAccess")}
      </label>
      <Button className="mt-4 w-full" onClick={onAction}>{actionLabel}</Button>
    </Card>
  );
}

function EnterpriseRecommendation({ onAction }: { onAction: () => void }) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-md p-4 shadow-none">
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("workspace.billing.drawer.moreFeatures")}</Badge>
      <h3 className="mt-4 text-xl font-semibold">{t("workspace.billing.drawer.upgradeEnterprise")}</h3>
      <p className="mt-2 text-muted-foreground">{t("workspace.billing.drawer.enterpriseDescription")}</p>
      <p className="mt-6 text-sm text-muted-foreground">{t("workspace.billing.drawer.startingCapacity")}</p>
      <div className="text-3xl font-semibold">80,000</div>
      <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-blue-600" /></div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{t("workspace.billing.drawer.includedMau", { mau: "80K" })}</span><span>{t("workspace.billing.drawer.upTo", { mau: "300K" })}</span></div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine label={t("workspace.billing.drawer.enterpriseMonthly")} value={t("workspace.billing.overview.perMonth", { amount: "$449" })} />
        <FeeLine label={t("workspace.billing.drawer.yearlyOption")} value={t("workspace.billing.drawer.enterpriseYearly")} />
        <FeeLine label={t("workspace.billing.drawer.includedFeatures")} value={t("workspace.billing.drawer.enterpriseFeatures")} />
        <FeeLine label={t("workspace.billing.drawer.support")} value={t("workspace.billing.drawer.dedicatedSla")} />
      </div>
      <Button className="mt-4 w-full" onClick={onAction}>{t("workspace.billing.drawer.upgradeEnterprise")}</Button>
    </Card>
  );
}
