import { LicenseFeatureEnum } from "@shared/types";

export interface BillingInformation {
  companyName: string;
  contactEmail: string;
  address: string;
  addressLine2: string;
  taxId: string;
  country: string;
}

export interface BillingCycle {
  startDate: Date;
  endDate: Date;
}

export interface InvoiceItem {
  id: string;
  billingDate: string | null;
  plan: string | null;
  billingCycle: string | null;
  status: string;
  currency: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  amountFlat: number;
  amountMetered: number;
}

export interface Subscription {
  plan: string,
  billingCycle: string,
  mau: number,
  addOnFeatures: LicenseFeatureEnum[],
}

export interface CheckoutSession {
  url: string;
}
