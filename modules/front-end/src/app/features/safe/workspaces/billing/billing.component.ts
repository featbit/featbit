import { Component } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  BillingCycle,
  EXTRA_MAU_PER_10K_COST,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanKeys,
  PRICING_PLANS,
  PricingPlan
} from '@core/components/pricing-plans/types';

interface Invoice {
  id: string;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  amount: number;
  plan: string;
  downloadUrl?: string;
}

interface BillingInfo {
  companyName: string;
  contactEmail: string;
  address: string;
  addressLine2: string;
  taxId: string;
  country: string;
}

interface BillingWorkspacePlan {
  key: string;
  name: string;
  order: number;
  billingCycle: string;
  includedMau: number;
  extraMau: number;
  mauUsed: number;
  fineGrainedAcEnabled: boolean;
  basePrice: number;
  nextBillingDate: string;
  subscriptionStartDate: string;
  currentBillingPeriod: string;
}

@Component({
  selector: 'billing',
  standalone: false,
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.less'
})
export class BillingComponent {
  constructor(private modal: NzModalService) {
  }

  private readonly freePlanDefinition = PRICING_PLANS.find(plan => plan.key === PlanKeys.FREE) ?? PRICING_PLANS[0];

  // Mocked workspace billing state. If this becomes null, the page falls back to the Free plan.
  private readonly workspacePlan: BillingWorkspacePlan | null = {
    key: PlanKeys.GROWTH,
    name: 'Growth',
    order: 2,
    billingCycle: BillingCycle.MONTHLY,
    includedMau: 40_000,
    extraMau: 20_000,
    mauUsed: 54_240,
    fineGrainedAcEnabled: true,
    basePrice: 149,
    nextBillingDate: 'May 20, 2026',
    subscriptionStartDate: 'Jan 20, 2026',
    currentBillingPeriod: 'Apr 20, 2026 - May 19, 2026'
  };

  get currentPlan(): BillingWorkspacePlan {
    return this.workspacePlan ?? this.createDefaultFreePlan();
  }

  get currentPlanDefinition(): PricingPlan {
    return PRICING_PLANS.find(plan => plan.key === this.currentPlan.key) ?? this.freePlanDefinition;
  }

  get isDefaultFreePlan(): boolean {
    return this.workspacePlan === null;
  }

  get billingCycleLabel(): string {
    return this.currentPlan.billingCycle === BillingCycle.YEARLY ? 'Yearly billing' : 'Monthly billing';
  }

  get billingCycleSuffix(): string {
    return this.currentPlan.billingCycle === BillingCycle.YEARLY ? '/ year' : '/ month';
  }

  get basePrice(): number {
    return this.currentPlan.basePrice;
  }

  get extraMau(): number {
    return this.currentPlan.extraMau;
  }

  get currentMau(): number {
    return this.currentPlan.includedMau + this.currentPlan.extraMau;
  }

  get mauUsed(): number {
    return this.currentPlan.mauUsed;
  }

  get fineGrainedAcEnabled(): boolean {
    return this.currentPlan.fineGrainedAcEnabled;
  }

  get planChargeAmount(): number {
    return this.basePrice + this.extraMauCost + this.fineGrainedAcCost;
  }

  get extraMauCost(): number {
    return (this.extraMau / 10_000) * EXTRA_MAU_PER_10K_COST;
  }

  get fineGrainedAcCost(): number {
    return this.fineGrainedAcEnabled ? FINE_GRAINED_AC_PER_MONTH_PRICE : 0;
  }

  get mauUsagePercent(): number {
    return Math.round((this.mauUsed / this.currentMau) * 100);
  }

  get mauRemaining(): number {
    return Math.max(0, this.currentMau - this.mauUsed);
  }

  get overageRiskLabel(): string {
    if (this.mauUsagePercent >= 95) {
      return 'Critical headroom';
    }

    if (this.mauUsagePercent >= 80) {
      return 'Watch usage closely';
    }

    return 'Healthy headroom';
  }

  get showUsageAlert(): boolean {
    return this.mauUsagePercent >= 90;
  }

  get isMauExceeded(): boolean {
    return this.mauUsagePercent >= 100;
  }

  billingInfo: BillingInfo = {
    companyName: 'Northstar Labs',
    contactEmail: 'finance@northstarlabs.io',
    address: '548 Market Street, San Francisco, CA 94104',
    addressLine2: 'Suite 214',
    taxId: 'US-TAX-928173645',
    country: 'United States'
  };
  editingBillingInfo = false;
  billingInfoDraft: BillingInfo = { ...this.billingInfo };
  invoices: Invoice[] = [
    { id: 'INV-2026-004', date: 'Apr 20, 2026', status: 'pending', amount: 249, plan: 'Growth' },
    { id: 'INV-2026-003', date: 'Mar 20, 2026', status: 'paid', amount: 249, plan: 'Growth' },
    { id: 'INV-2026-002', date: 'Feb 20, 2026', status: 'paid', amount: 209, plan: 'Growth' },
    { id: 'INV-2026-001', date: 'Jan 20, 2026', status: 'paid', amount: 189, plan: 'Growth' },
    { id: 'INV-2025-012', date: 'Dec 20, 2025', status: 'paid', amount: 49, plan: 'Pro' },
  ];
  // invoices: Invoice[] = [];

  getInvoiceStatusLabel(status: string): string {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  }

  startEditBillingInfo(): void {
    this.billingInfoDraft = { ...this.billingInfo };
    this.editingBillingInfo = true;
  }

  saveBillingInfo(): void {
    this.billingInfo = { ...this.billingInfoDraft };
    this.editingBillingInfo = false;
  }

  cancelEditBillingInfo(): void {
    this.editingBillingInfo = false;
  }

  cancelSubscription(): void {
    this.modal.confirm({
      nzTitle: 'Cancel Subscription',
      nzContent: 'Are you sure you want to cancel your subscription? You will lose access to paid features at the end of your current billing period.',
      nzOkText: 'Yes, Cancel',
      nzOkDanger: true,
      nzCancelText: 'Keep Plan',
      nzOnOk: () => {
        console.log('Subscription cancelled');
      }
    });
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  pricingDrawerVisible = false;

  openPricingDrawer(): void {
    this.pricingDrawerVisible = true;
  }

  onClosePricingDrawer(): void {
    this.pricingDrawerVisible = false;
  }

  private createDefaultFreePlan(): BillingWorkspacePlan {
    return {
      key: this.freePlanDefinition.key,
      name: this.freePlanDefinition.name,
      order: this.freePlanDefinition.order,
      billingCycle: BillingCycle.MONTHLY,
      includedMau: this.freePlanDefinition.mauIncluded,
      extraMau: 0,
      mauUsed: 320,
      fineGrainedAcEnabled: false,
      basePrice: 0,
      nextBillingDate: 'No upcoming charge',
      subscriptionStartDate: 'Not subscribed',
      currentBillingPeriod: 'Current usage cycle'
    };
  }
}
