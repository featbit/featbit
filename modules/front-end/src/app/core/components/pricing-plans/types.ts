import { WorkspacePlan } from "@shared/types";

export interface PricingPlan {
  key: string;
  name: string;
  description: string;
  order: number;
  price: number;
  billingCycle: 'month' | 'year';
  mauIncluded: number;
  mauMax: number;
  mauStep: number;
  features: string[];
  contactSales?: boolean;
}

export type PlanAction = 'upgrade' | 'downgrade' | 'update';

export interface UpdatePlanModalData {
  action: PlanAction;
  currentPlan: WorkspacePlan;
  newPlan: WorkspacePlan;
  basePrice: number;
}

export const PlanKeys = {
  FREE: 'free',
  PRO: 'pro',
  GROWTH: 'growth',
  ENTERPRISE: 'enterprise'
}

export const BillingCycle = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
}

export const EXTRA_MAU_PER_10K_COST = 20; // $20 per 10K extra MAU
export const FINE_GRAINED_AC_PER_MONTH_PRICE = 60; // $100 per month for fine-grained access control addon

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: PlanKeys.FREE,
    name: 'Free',
    description: 'Get started with core feature flags at no cost.',
    order: 0,
    price: 0,
    billingCycle: 'month',
    mauIncluded: 1000,
    mauMax: 1000,
    mauStep: 0,
    features: [
      '1,000 MAU',
      'Core feature flags',
      'Advanced targeting and segmentation',
      'Unlimited Projects & Environments',
      'Webhooks and integrations',
      'Audit Logs',
      'IAM / RBAC (Basic)',
      'Community support'
    ]
  },
  {
    key: PlanKeys.PRO,
    name: 'Pro',
    description: 'For growing teams need scale and support.',
    order: 1,
    price: 49,
    billingCycle: 'month',
    mauIncluded: 10_000,
    mauMax: 300_000,
    mauStep: 10_000,
    features: [ '10K MAU included', 'Priority support' ]
  },
  {
    key: PlanKeys.GROWTH,
    name: 'Growth',
    description: 'Advanced controls for scaling product teams.',
    order: 2,
    price: 149,
    billingCycle: 'month',
    mauIncluded: 40_000,
    mauMax: 300_000,
    mauStep: 10_000,
    features: [ '40K MAU included', 'Flag Change Approval', 'Flag Change Scheduling', 'Flag comparison' ]
  },
  {
    key: PlanKeys.ENTERPRISE,
    name: 'Enterprise',
    description: 'Full-featured platform for large organizations.',
    order: 3,
    price: 449,
    billingCycle: 'month',
    mauIncluded: 80_000,
    mauMax: 300_000,
    mauStep: 10_000,
    features: [
      '80k MAU included',
      'Private Discord channel',
      '12-business-hour reply SLA',
      '4-business-hour reply SLA',
      'Dedicated SLA & support',
      'Dedicated onboarding & training',
      'Single Sign-On',
      'Multi-organization',
      'Global users & Shareable segments',
      'FeatBit Auto agents'
    ]
  }
];
