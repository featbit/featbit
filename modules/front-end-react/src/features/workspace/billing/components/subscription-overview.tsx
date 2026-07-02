import { BarChart3, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BillingSubscription } from "../billing-api";
import {
  FINE_GRAINED_ACCESS,
  currentTotal,
  formatDate,
  formatMoneyPerCycle,
  normalizePlan,
  planMeta,
  type UsageStats
} from "../billing-utils";
import { FeeRow, PeriodItem } from "./billing-display";

export function SubscriptionOverview({
  subscription,
  cycle,
  isLoading,
  stats,
  lang,
  onManage
}: {
  subscription?: BillingSubscription;
  cycle?: { start?: string; end?: string };
  isLoading: boolean;
  stats: UsageStats;
  lang: "en" | "zh";
  onManage: () => void;
}) {
  const plan = planMeta[normalizePlan(subscription?.plan)];
  const addOnEnabled = subscription?.addOnFeatures?.includes(FINE_GRAINED_ACCESS) ?? false;
  const total = currentTotal(subscription);
  const isFree = normalizePlan(subscription?.plan) === "free";
  const progressColor = stats.used > stats.purchased ? "bg-destructive" : stats.percent >= 90 ? "bg-amber-500" : "bg-blue-600";

  if (isLoading) {
    return (
      <Card className="space-y-5 rounded-md p-5 shadow-none">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-md shadow-none">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-md border bg-muted/30 text-blue-600">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-normal">{plan.name}</h2>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                {subscription?.billingCycle === "yearly" ? "Yearly billing" : "Monthly billing"}
              </Badge>
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-2xl font-semibold">{formatMoneyPerCycle(plan.basePrice, subscription?.billingCycle)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            {subscription?.pendingDowngrade ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                <Info className="h-3.5 w-3.5" />
                Scheduled downgrade: Your plan will move to {planMeta[normalizePlan(subscription.pendingDowngrade.plan)].name} on {formatDate(subscription.pendingDowngrade.effectiveAt, lang)}. Current access remains active until then.
              </div>
            ) : null}
          </div>
        </div>
        <Button className="h-10 px-5" onClick={onManage}>Manage subscription</Button>
      </div>

      {!isFree ? (
        <div className="grid border-y bg-muted/10 md:grid-cols-3">
          <PeriodItem label="Billing period" value={`${formatDate(subscription?.currentPeriodStart ?? cycle?.start, lang)} - ${formatDate(subscription?.currentPeriodEnd ?? cycle?.end, lang)}`} />
          <PeriodItem label="Next charge" value={formatDate(subscription?.currentPeriodEnd, lang)} />
          <PeriodItem label="Subscriber since" value={formatDate(subscription?.createdAt, lang)} />
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="rounded-md border p-5">
          <h3 className="font-semibold">Current usage</h3>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Monthly Active Users (MAU)</span>
            <span>{stats.percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", progressColor)} style={{ width: `${Math.min(stats.percent, 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{stats.used.toLocaleString()} of {stats.purchased.toLocaleString()} used</span>
            <span>{stats.remaining.toLocaleString()} remaining</span>
          </div>
          <p className={cn("mt-3 text-sm font-semibold", stats.percent >= 90 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
            {stats.percent >= 90 ? "! Watch usage closely" : "Healthy headroom"}
          </p>
        </div>
        <div className="rounded-md border p-5">
          <h3 className="font-semibold">Fee breakdown</h3>
          <FeeRow label={`${plan.name} plan`} value={`$${plan.basePrice}/month`} />
          {addOnEnabled ? <FeeRow label="Fine-grained Access Control" value="+ $60/month" info /> : null}
          <div className="mt-3 border-t pt-3">
            <FeeRow label="Total charge" value={`$${total}/month`} strong />
          </div>
        </div>
      </div>
    </Card>
  );
}
