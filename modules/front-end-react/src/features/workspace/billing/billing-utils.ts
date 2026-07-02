import type { BillingCycle, BillingSubscription, SubscriptionChangePayload } from "./billing-api";

export const HOSTING_MODE_SAAS = "saas";
export const FINE_GRAINED_ACCESS = "Fine-grained Access Control";

export const planMeta = {
  free: { name: "Free", nameKey: "workspace.billing.plans.free.name", descriptionKey: "workspace.billing.plans.free.description", basePrice: 0, includedMau: 1000, monthlyPrice: 0 },
  pro: { name: "Pro", nameKey: "workspace.billing.plans.pro.name", descriptionKey: "workspace.billing.plans.pro.description", basePrice: 49, includedMau: 10000, monthlyPrice: 49 },
  growth: { name: "Growth", nameKey: "workspace.billing.plans.growth.name", descriptionKey: "workspace.billing.plans.growth.description", basePrice: 149, includedMau: 40000, monthlyPrice: 149 },
  enterprise: { name: "Enterprise", nameKey: "workspace.billing.plans.enterprise.name", descriptionKey: "workspace.billing.plans.enterprise.description", basePrice: 449, includedMau: 80000, monthlyPrice: 449 }
};

export type PlanKey = keyof typeof planMeta;

export type BillingInfoForm = {
  companyName: string;
  contactEmail: string;
  address: string;
  addressLine2: string;
  taxId: string;
  countryOrRegion: string;
};

export type DrawerIntent = "manage" | "upgrade";

export type PendingChange = {
  kind: "upgrade" | "downgrade";
  payload: SubscriptionChangePayload;
  currentTotal: number;
  nextTotal: number;
};

export type UsageStats = ReturnType<typeof usageStats>;

export function normalizePlan(plan?: string): PlanKey {
  const key = (plan ?? "free").toLowerCase();
  return key in planMeta ? key as PlanKey : "free";
}

export function formatDate(value?: string, lang: "en" | "zh" = "en") {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatCurrency(amount: number, currency = "USD", compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2
  }).format(amount);
}

export function formatMoneyPerCycle(amount: number, cycle?: BillingCycle) {
  const suffix = cycle === "yearly" ? "year" : "month";
  return `$${amount.toLocaleString("en-US")} / ${suffix}`;
}

export function currentTotal(subscription?: BillingSubscription) {
  if (!subscription) {
    return 0;
  }

  const plan = planMeta[normalizePlan(subscription.plan)];
  const base = subscription.unitAmount ? subscription.unitAmount / 100 : plan.basePrice;
  const addOn = subscription.addOnFeatures?.includes(FINE_GRAINED_ACCESS) ? 60 : 0;
  return base + addOn;
}

export function usageStats(subscription?: BillingSubscription, cycle?: { mau?: number }) {
  const purchased = subscription?.mau ?? subscription?.baseMau ?? planMeta[normalizePlan(subscription?.plan)].includedMau;
  const used = subscription?.usage?.mau ?? cycle?.mau ?? 0;
  const percent = purchased > 0 ? Math.round((used / purchased) * 100) : 0;
  return { purchased, used, remaining: Math.max(purchased - used, 0), percent };
}

export function fieldValue(value?: string | null) {
  return value?.trim() ? value : "Not provided";
}

export function planRank(plan: PlanKey) {
  return ["free", "pro", "growth", "enterprise"].indexOf(plan);
}

export function planTotal(payload: Pick<SubscriptionChangePayload, "plan" | "mau" | "addOnFeatures"> & Partial<Pick<SubscriptionChangePayload, "billingCycle">>) {
  const plan = planMeta[normalizePlan(payload.plan)];
  const extraMau = Math.max(payload.mau - plan.includedMau, 0);
  const extraMauPrice = Math.ceil(extraMau / 10000) * 20;
  const addOnPrice = payload.addOnFeatures.includes(FINE_GRAINED_ACCESS) ? 60 : 0;
  return plan.basePrice + extraMauPrice + addOnPrice;
}
