import { fetchApi } from "@/lib/api/authenticated-api"

export type BillingCycle = "monthly" | "yearly" | string

export type BillingSubscription = {
  plan?: string
  billingCycle?: BillingCycle
  baseMau?: number
  mau?: number
  usage?: {
    mau?: number
  }
  addOnFeatures?: string[]
  unitAmount?: number
  currentPeriodStart?: string
  currentPeriodEnd?: string
  periodStart?: string
  periodEnd?: string
  createdAt?: string
  subscriberSince?: string
  pendingDowngrade?: {
    plan?: string
    effectiveAt?: string
    billingCycle?: BillingCycle
    mau?: number
    addOnFeatures?: string[]
  } | null
  isLocal?: boolean
}

export type BillingCycleUsage = {
  start?: string
  end?: string
  startDate?: string
  endDate?: string
  periodStart?: string
  periodEnd?: string
  mau?: number
}

export type BillingInformation = {
  companyName?: string | null
  contactEmail?: string | null
  address?: string | null
  addressLine2?: string | null
  taxId?: string | null
  countryOrRegion?: string | null
  country?: string | null
}

export type BillingInvoice = {
  id?: string
  billingDate?: string
  createdAt?: string
  plan?: string
  status?: string
  amountPaid?: number
  amountDue?: number
  currency?: string
}

export type SubscriptionChangePayload = {
  plan: string
  billingCycle: BillingCycle
  mau: number
  addOnFeatures: string[]
}

export type ProrationPreview = {
  creditAmount?: number
  chargeAmount?: number
  totalDueToday?: number
  currency?: string
  immediateCharge?: {
    amount?: number
    displayLines?: Array<{
      label?: string
      amount?: number
      type?: "credit" | "charge" | string
    }>
  }
}

export type CheckoutSession = {
  url?: string
}

async function billingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

function normalizeBillingInformation(
  value: BillingInformation | string | boolean | null | undefined
): BillingInformation {
  if (!value) {
    return {}
  }

  if (typeof value === "boolean") {
    return {}
  }

  if (typeof value !== "string") {
    return value
  }

  try {
    return JSON.parse(value) as BillingInformation
  } catch {
    return {}
  }
}

function normalizeInvoices(
  value: BillingInvoice[] | string | null | undefined
): BillingInvoice[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
  }

  try {
    const parsedValue = JSON.parse(value) as unknown
    return Array.isArray(parsedValue) ? (parsedValue as BillingInvoice[]) : []
  } catch {
    return []
  }
}

function normalizeObject<T extends object>(
  value: T | string | null | undefined
): T | undefined {
  if (!value) {
    return undefined
  }

  if (typeof value !== "string") {
    return value
  }

  try {
    const parsedValue = JSON.parse(value) as unknown
    return parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
      ? (parsedValue as T)
      : undefined
  } catch {
    return undefined
  }
}

function normalizeUnknown(value: unknown) {
  if (typeof value !== "string") {
    return value
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function normalizeProrationPreview(
  value: ProrationPreview | string | null | undefined
): ProrationPreview | undefined {
  return normalizeObject<ProrationPreview>(value)
}

function toBillingInformationPayload(
  payload: BillingInformation
): BillingInformation {
  return {
    companyName: payload.companyName ?? null,
    contactEmail: payload.contactEmail ?? null,
    address: payload.address ?? null,
    addressLine2: payload.addressLine2 ?? null,
    taxId: payload.taxId ?? null,
    country: payload.countryOrRegion ?? payload.country ?? null,
  }
}

function toSubscriptionPayload(
  payload: SubscriptionChangePayload
): SubscriptionChangePayload {
  return {
    ...payload,
    billingCycle:
      payload.billingCycle === "yearly"
        ? "year"
        : payload.billingCycle === "monthly"
          ? "month"
          : payload.billingCycle,
  }
}

export async function fetchSubscription() {
  const subscription = await billingRequest<BillingSubscription | string>(
    "/api/v1/billing/subscription"
  )
  return normalizeObject<BillingSubscription>(subscription)
}

export async function fetchCurrentCycle() {
  const cycle = await billingRequest<BillingCycleUsage | string>(
    "/api/v1/billing/current-cycle"
  )
  return normalizeObject<BillingCycleUsage>(cycle)
}

export async function fetchBillingInformation() {
  const information = await billingRequest<BillingInformation | string>(
    "/api/v1/billing/billing-information"
  )
  return normalizeBillingInformation(information)
}

export async function updateBillingInformation(payload: BillingInformation) {
  return billingRequest<boolean>("/api/v1/billing/billing-information", {
    method: "PUT",
    body: JSON.stringify(toBillingInformationPayload(payload)),
  })
}

export async function fetchInvoices() {
  const invoices = await billingRequest<BillingInvoice[] | string>(
    "/api/v1/billing/invoices"
  )
  return normalizeInvoices(invoices)
}

export async function fetchBillingLicense() {
  const license = await billingRequest<unknown>("/api/v1/billing/license")
  return normalizeUnknown(license)
}

export async function previewProration(payload: SubscriptionChangePayload) {
  const preview = await billingRequest<ProrationPreview | string>(
    "/api/v1/billing/subscription/proration-preview",
    {
      method: "POST",
      body: JSON.stringify(toSubscriptionPayload(payload)),
    }
  )

  return normalizeProrationPreview(preview)
}

export async function createSubscription(payload: SubscriptionChangePayload) {
  const session = await billingRequest<CheckoutSession | string>(
    "/api/v1/billing/subscription",
    {
      method: "POST",
      body: JSON.stringify(toSubscriptionPayload(payload)),
    }
  )

  return normalizeObject<CheckoutSession>(session)
}

export async function updateSubscription(
  kind: "upgrade" | "downgrade",
  payload: SubscriptionChangePayload
) {
  const subscription = await billingRequest<BillingSubscription | string>(
    `/api/v1/billing/subscription/${kind}`,
    {
      method: "POST",
      body: JSON.stringify(toSubscriptionPayload(payload)),
    }
  )

  return normalizeObject<BillingSubscription>(subscription)
}
