import { useState } from "react";
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
  const currentPlan = normalizePlan(subscription?.plan);
  const [selectedMau, setSelectedMau] = useState(subscription?.mau ?? planMeta[currentPlan].includedMau);
  const [fineGrained, setFineGrained] = useState(subscription?.addOnFeatures?.includes(FINE_GRAINED_ACCESS) ?? false);
  const billingCycle = subscription?.billingCycle ?? "monthly";

  const title = intent === "upgrade" ? "Upgrade plan" : "Manage subscription";
  const description = intent === "upgrade"
    ? "Increase capacity before this billing cycle reaches its MAU limit."
    : "Review plans, MAU capacity, add-ons, and billing cycle for this workspace.";

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
                <Button variant="outline" asChild><a href="mailto:support@featbit.co">Contact support</a></Button>
              ) : null}
            </div>
          </SheetHeader>
        </div>
        <div className="space-y-4 p-6">
          {intent === "upgrade" ? (
            <div className="flex items-center justify-between rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
              <div>
                <div className="font-semibold">Approaching MAU limit</div>
                <div className="text-sm">{stats.used.toLocaleString()} of {stats.purchased.toLocaleString()} MAU used - {stats.percent}% of current capacity.</div>
              </div>
              <Badge variant="outline" className="bg-background">{stats.remaining.toLocaleString()} remaining</Badge>
            </div>
          ) : (
            <div className="grid rounded-md border md:grid-cols-4">
              <PeriodItem label="Current plan" value={`${planMeta[currentPlan].name} - ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`} />
              <PeriodItem label="MAU capacity" value={(subscription?.mau ?? planMeta[currentPlan].includedMau).toLocaleString()} />
              <PeriodItem label="Next charge" value={formatDate(subscription?.currentPeriodEnd)} />
              <PeriodItem label="Current total" value={`$${currentTotal(subscription)}/month`} />
            </div>
          )}

          {intent === "upgrade" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <RecommendationCard
                label="Fastest fix"
                title={`Add capacity to ${planMeta[currentPlan].name}`}
                description="Keep your current plan and increase MAU for the next invoice."
                selectedMau={selectedMau}
                setSelectedMau={setSelectedMau}
                fineGrained={fineGrained}
                setFineGrained={setFineGrained}
                actionLabel="Update plan"
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
  const isCurrent = planKey === currentPlan;
  const changed = isCurrent && (selectedMau !== meta.includedMau || fineGrained);
  const actionLabel = isCurrent ? (changed ? "Update plan" : "Current plan") : `${planRank(planKey) > planRank(currentPlan) ? "Upgrade" : "Downgrade"} to ${meta.name}`;

  return (
    <Card className={cn("flex min-h-72 flex-col rounded-md p-4 shadow-none", isCurrent && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20")}>
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold">{meta.name}</h3>
        {isCurrent ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Current plan</Badge> : null}
      </div>
      <p className="mt-2 min-h-10 text-sm text-muted-foreground">{meta.description}</p>
      <div className="mt-6 text-2xl font-semibold">{formatMoneyPerCycle(isCurrent ? planTotal({ plan: planKey, billingCycle, mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] }) : meta.monthlyPrice, billingCycle)}</div>
      <div className="mt-5 h-2 rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-blue-600" />
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>- {meta.includedMau.toLocaleString()} MAU {planKey === "free" ? "" : "included"}</p>
        <p>- {planKey === "free" ? "Community support" : "Priority support"}</p>
        {isCurrent && planKey !== "free" ? (
          <>
            <Label className="mt-3 block text-foreground">Selected MAU</Label>
            <Input type="range" min={meta.includedMau} max={300000} step={10000} value={selectedMau} onChange={(event) => onMauChange(Number(event.target.value))} />
            <label className="flex items-center gap-2 text-foreground">
              <Checkbox checked={fineGrained} onCheckedChange={(checked) => onFineGrainedChange(checked === true)} />
              Fine-grained access
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
  return (
    <Card className="grid gap-4 rounded-md p-4 shadow-none lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
      <div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Recommended for scale</Badge>
        <h3 className="mt-3 text-xl font-semibold">Enterprise</h3>
        <p className="mt-1 text-sm text-muted-foreground">Full platform features for large organizations.</p>
        <div className="mt-3 inline-flex overflow-hidden rounded-md border">
          <span className="bg-primary px-3 py-1.5 text-xs text-primary-foreground">Monthly</span>
          <span className="px-3 py-1.5 text-xs">Yearly</span>
        </div>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="h-2 rounded-full bg-muted"><div className="h-full w-2/3 rounded-full bg-blue-600" /></div>
        <p>80K MAU included - annual billing available - SSO - Global Users</p>
        <p>- Dedicated SLA and onboarding</p>
        <p>- Multi-organization and advanced governance</p>
      </div>
      <Button onClick={() => onAction({ plan: "enterprise", billingCycle, mau: 80000, addOnFeatures: [FINE_GRAINED_ACCESS] })}>
        {planRank("enterprise") > planRank(currentPlan) ? "Upgrade to Enterprise" : "Current plan"}
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
  const total = planTotal({ plan: "growth", billingCycle: "monthly", mau: selectedMau, addOnFeatures: fineGrained ? [FINE_GRAINED_ACCESS] : [] });
  return (
    <Card className={cn("rounded-md p-4 shadow-none", highlighted && "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20")}>
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{label}</Badge>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm text-muted-foreground">Selected MAU</p>
      <div className="text-3xl font-semibold">{selectedMau.toLocaleString()}</div>
      <Input className="mt-3" type="range" min={40000} max={300000} step={10000} value={selectedMau} onChange={(event) => setSelectedMau(Number(event.target.value))} />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>40K included</span><span>+{Math.max(selectedMau - 40000, 0) / 1000}K extended</span></div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine label="Growth base" value="$149/month" />
        <FeeLine label="Extended MAU" value={`+$${Math.max((selectedMau - 40000) / 10000, 0) * 20}/month`} />
        <FeeLine label="Fine-grained Access Control" value={fineGrained ? "+$60/month" : "$0/month"} />
        <FeeLine label="Projected total" value={`$${total}/month`} strong />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox checked={fineGrained} onCheckedChange={(checked) => setFineGrained(checked === true)} />
        Fine-grained access
      </label>
      <Button className="mt-4 w-full" onClick={onAction}>{actionLabel}</Button>
    </Card>
  );
}

function EnterpriseRecommendation({ onAction }: { onAction: () => void }) {
  return (
    <Card className="rounded-md p-4 shadow-none">
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">More features</Badge>
      <h3 className="mt-4 text-xl font-semibold">Upgrade to Enterprise</h3>
      <p className="mt-2 text-muted-foreground">Move to higher included MAU and unlock enterprise controls.</p>
      <p className="mt-6 text-sm text-muted-foreground">Starting capacity</p>
      <div className="text-3xl font-semibold">80,000</div>
      <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-blue-600" /></div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>80K included</span><span>up to 300K</span></div>
      <div className="mt-4 rounded-md border text-sm">
        <FeeLine label="Enterprise monthly" value="$449/month" />
        <FeeLine label="Yearly option" value="$4,490/year" />
        <FeeLine label="Included features" value="SSO + Global Users" />
        <FeeLine label="Support" value="Dedicated SLA" />
      </div>
      <Button className="mt-4 w-full" onClick={onAction}>Upgrade to Enterprise</Button>
    </Card>
  );
}
