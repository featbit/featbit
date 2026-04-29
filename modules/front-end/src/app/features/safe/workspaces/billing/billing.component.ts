import { Component, inject, OnInit } from '@angular/core';
import {
  BillingCycle,
  EXTRA_MAU_PER_10K_COST,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanKeys,
  PRICING_PLANS,
  PricingPlan
} from '@core/components/pricing-plans/types';
import { WorkspaceSubscription } from "@shared/types";
import { BillingService } from "@services/billing.service";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'billing',
  standalone: false,
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.less'
})
export class BillingComponent implements OnInit {
  private billingService = inject(BillingService);
  private message = inject(NzMessageService);

  subscription: WorkspaceSubscription;
  isLoadingCurrentSubscription = true;

  ngOnInit() {
    this.billingService.getCurrentSubscription().subscribe({
      next: subscription => {
        this.isLoadingCurrentSubscription = false;
        this.subscription = subscription;
      },
      error: () => this.message.error('Failed to load current subscription. Please try again later.')
    })
  }

  private readonly freePlanDefinition = PRICING_PLANS.find(plan => plan.key === PlanKeys.FREE) ?? PRICING_PLANS[0];

  // Mocked workspace billing state. If this becomes null, the page falls back to the Free plan.
  private readonly workspacePlan: WorkspaceSubscription | null = {
    key: PlanKeys.GROWTH,
    name: 'Growth',
    order: 2,
    billingCycle: BillingCycle.MONTHLY,
    includedMau: 40_000,
    extraMau: 20_000,
    totalMau: 60_000,
    price: 149 + (20_000 / 10_000) * EXTRA_MAU_PER_10K_COST + FINE_GRAINED_AC_PER_MONTH_PRICE,
    fineGrainedAcEnabled: true,
    currentPeriodStart: new Date('2026-04-20'),
    currentPeriodEnd: new Date('2026-05-19'),
    subscriberSince: new Date('2026-01-20'),
  };

  get currentPlan(): WorkspaceSubscription {
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
    // TODO: use real base price
    return 149;
  }

  get extraMau(): number {
    return this.currentPlan.extraMau;
  }

  get currentMau(): number {
    return this.currentPlan.includedMau + this.currentPlan.extraMau;
  }

  get mauUsed(): number {
    // TODO: call usage API to get real usage data
    return 54_240;
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

  get currentBillingPeriod(): string {
    const start = this.currentPlan.currentPeriodStart;
    const end = this.currentPlan.currentPeriodEnd;
    if (!start || !end) {
      return '';
    }

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  }

  get nextBillingDate(): string {
    const end = this.currentPlan.currentPeriodEnd;
    if (!end) {
      return '';
    }

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return end.toLocaleDateString(undefined, options);
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

  private createDefaultFreePlan(): WorkspaceSubscription {
    return {
      key: this.freePlanDefinition.key,
      name: this.freePlanDefinition.name,
      order: this.freePlanDefinition.order,
      billingCycle: BillingCycle.MONTHLY,
      includedMau: this.freePlanDefinition.mauIncluded,
      extraMau: 0,
      totalMau: 0,
      fineGrainedAcEnabled: false,
      price: this.freePlanDefinition.price,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      subscriberSince: new Date()
    };
  }
}
