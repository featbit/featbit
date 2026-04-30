import { Component, inject, OnInit } from '@angular/core';
import {
  BillingCycle,
  EXTRA_MAU_PER_10K_PER_MONTH_PRICE,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanKeys,
  PRICING_PLANS,
  PricingPlan
} from '@core/components/pricing-plans/types';
import { WorkspaceSubscription } from "@shared/types";
import { BillingService } from "@services/billing.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { formatDate } from "@angular/common";

@Component({
  selector: 'billing',
  standalone: false,
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.less'
})
export class BillingComponent implements OnInit {
  private billingService = inject(BillingService);
  private message = inject(NzMessageService);

  isLoading = true;

  subscription: WorkspaceSubscription;
  plan: PricingPlan;
  isFreePlan = true;

  ngOnInit() {
    this.billingService.getCurrentSubscription().subscribe({
      next: subscription => {
        this.subscription = subscription;
        this.plan = PRICING_PLANS.find(plan => plan.key === subscription.key) ?? PRICING_PLANS[0];
        this.isFreePlan = this.subscription.key === PlanKeys.FREE;
        this.isLoading = false;
      },
      error: () => this.message.error('Failed to load current subscription. Please try again later.')
    })
  }

  get billingCycleLabel(): string {
    return this.subscription.billingCycle === BillingCycle.YEARLY ? 'Yearly billing' : 'Monthly billing';
  }

  get billingCycleSuffix(): string {
    return this.subscription.billingCycle === BillingCycle.YEARLY ? '/ year' : '/ month';
  }

  get mauUsed(): number {
    // TODO: call usage API to get real usage data
    return 800;
  }

  get extraMauCost(): number {
    const isEnterpriseYearly =
      this.subscription.key === PlanKeys.ENTERPRISE && this.subscription.billingCycle === BillingCycle.YEARLY;
    const totalMonth = isEnterpriseYearly ? 12 : 1;

    return (this.subscription.extraMau / 10_000) * EXTRA_MAU_PER_10K_PER_MONTH_PRICE * totalMonth;
  }

  get fineGrainedAcCost(): number {
    const isEnterpriseYearly =
      this.subscription.key === PlanKeys.ENTERPRISE && this.subscription.billingCycle === BillingCycle.YEARLY;
    const totalMonth = isEnterpriseYearly ? 12 : 1;

    return this.subscription.fineGrainedAcEnabled
      ? FINE_GRAINED_AC_PER_MONTH_PRICE * totalMonth
      : 0;
  }

  get mauUsagePercent(): number {
    return Math.round((this.mauUsed / this.subscription.totalMau) * 100);
  }

  get mauRemaining(): number {
    return Math.max(0, this.subscription.totalMau - this.mauUsed);
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
    return this.subscription.totalMau < this.mauUsed;
  }

  get currentBillingPeriod(): string {
    const start = this.subscription.currentPeriodStart;
    const end = this.subscription.currentPeriodEnd;

    const startString = start ? formatDate(start, 'MMM d, y', 'en-US') : '';
    const endString =
      this.subscription.key === PlanKeys.FREE
        ? 'forever'
        : end
          ? formatDate(end, 'MMM d, y', 'en-US')
          : '';

    return `${startString} - ${endString}`;
  }

  get nextBillingDate(): string {
    const end = this.subscription.currentPeriodEnd;
    if (!end) {
      return 'N/A';
    }

    end.setDate(end.getDate() + 1);
    return formatDate(end, 'MMM d, y', 'en-US');
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
}
