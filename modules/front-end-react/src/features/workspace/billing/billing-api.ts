import { fetchApi } from "@/features/layout/context";

export type BillingCycle = "monthly" | "yearly" | string;

export type BillingSubscription = {
  plan?: string;
  billingCycle?: BillingCycle;
  baseMau?: number;
  mau?: number;
  usage?: {
    mau?: number;
  };
  addOnFeatures?: string[];
  unitAmount?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  createdAt?: string;
  pendingDowngrade?: {
    plan?: string;
    effectiveAt?: string;
    billingCycle?: BillingCycle;
    mau?: number;
    addOnFeatures?: string[];
  } | null;
  isLocal?: boolean;
};

export type BillingCycleUsage = {
  start?: string;
  end?: string;
  mau?: number;
};

export type BillingInformation = {
  companyName?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  addressLine2?: string | null;
  taxId?: string | null;
  countryOrRegion?: string | null;
  country?: string | null;
};

export type BillingInvoice = {
  id?: string;
  billingDate?: string;
  createdAt?: string;
  plan?: string;
  status?: string;
  amountPaid?: number;
  amountDue?: number;
  currency?: string;
};

export type SubscriptionChangePayload = {
  plan: string;
  billingCycle: BillingCycle;
  mau: number;
  addOnFeatures: string[];
};

export type ProrationPreview = {
  creditAmount?: number;
  chargeAmount?: number;
  totalDueToday?: number;
  currency?: string;
};

async function billingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchApi<T>(path, undefined, true, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
}

function normalizeBillingInformation(value: BillingInformation | string | boolean | null | undefined): BillingInformation {
  if (!value) {
    return {};
  }

  if (typeof value === "boolean") {
    return {};
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as BillingInformation;
  } catch {
    return {};
  }
}

function toBillingInformationPayload(payload: BillingInformation): BillingInformation {
  return {
    companyName: payload.companyName ?? null,
    contactEmail: payload.contactEmail ?? null,
    address: payload.address ?? null,
    addressLine2: payload.addressLine2 ?? null,
    taxId: payload.taxId ?? null,
    country: payload.countryOrRegion ?? payload.country ?? null
  };
}

export function fetchSubscription() {
  return billingRequest<BillingSubscription>("/api/v1/billing/subscription");
}

export function fetchCurrentCycle() {
  return billingRequest<BillingCycleUsage>("/api/v1/billing/current-cycle");
}

export async function fetchBillingInformation() {
  const information = await billingRequest<BillingInformation | string>("/api/v1/billing/billing-information");
  return normalizeBillingInformation(information);
}

export async function updateBillingInformation(payload: BillingInformation) {
  const savedPayload = toBillingInformationPayload(payload);
  const information = await billingRequest<BillingInformation | string | boolean>("/api/v1/billing/billing-information", {
    method: "PUT",
    body: JSON.stringify(savedPayload)
  });
  const normalizedInformation = normalizeBillingInformation(information);
  return Object.keys(normalizedInformation).length > 0 ? normalizedInformation : savedPayload;
}

export function fetchInvoices() {
  return billingRequest<BillingInvoice[]>("/api/v1/billing/invoices");
}

export function fetchBillingLicense() {
  return billingRequest<unknown>("/api/v1/billing/license");
}

export function previewProration(payload: SubscriptionChangePayload) {
  return billingRequest<ProrationPreview>("/api/v1/billing/subscription/proration-preview", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSubscription(kind: "upgrade" | "downgrade", payload: SubscriptionChangePayload) {
  return billingRequest<BillingSubscription>(`/api/v1/billing/subscription/${kind}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
