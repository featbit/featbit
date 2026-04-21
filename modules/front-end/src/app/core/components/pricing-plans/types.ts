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
  extraMauCost: number;
  features: string[];
  contactSales?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: 'free',
    name: 'Free',
    description: 'Get started with core feature flags at no cost.',
    order: 0,
    price: 0,
    billingCycle: 'month',
    mauIncluded: 1000,
    mauMax: 1000,
    mauStep: 0,
    extraMauCost: 0,
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
    key: 'pro',
    name: 'Pro',
    description: 'For growing teams need scale and support.',
    order: 1,
    price: 49,
    billingCycle: 'month',
    mauIncluded: 10000,
    mauMax: 300000,
    mauStep: 10000,
    extraMauCost: 20,
    features: [ '10K MAU included', 'Priority support' ]
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'Advanced controls for scaling product teams.',
    order: 2,
    price: 149,
    billingCycle: 'month',
    mauIncluded: 40000,
    mauMax: 300000,
    mauStep: 10000,
    extraMauCost: 20,
    features: [ '40K MAU included', 'Flag Change Approval', 'Flag Change Scheduling', 'Flag comparison' ]
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Full-featured platform for large organizations.',
    order: 3,
    price: 449,
    billingCycle: 'month',
    mauIncluded: 80000,
    mauMax: 300000,
    mauStep: 10000,
    extraMauCost: 20,
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
