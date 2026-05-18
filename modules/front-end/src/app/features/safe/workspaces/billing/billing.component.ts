import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { NzNotificationService } from "ng-zorro-antd/notification";
import { formatDate } from "@angular/common";
import { subDays } from "date-fns";

@Component({
  selector: 'billing',
  standalone: false,
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.less'
})
export class BillingComponent implements OnInit {
  private billingService = inject(BillingService);
  private message = inject(NzMessageService);
  private notification = inject(NzNotificationService);
  private route = inject(ActivatedRoute);

  isLoading = true;

  subscription: WorkspaceSubscription;
  plan: PricingPlan;
  pendingDowngrade = undefined;
  isFreePlan = true;

  ngOnInit() {
    const pending = sessionStorage.getItem('billingNotification');
    if (pending) {
      sessionStorage.removeItem('billingNotification');
      const { title, message } = JSON.parse(pending);
      this.notification.success(title, message, { nzDuration: 7_000 });
    }

    this.billingService.getCurrentSubscription().subscribe({
      next: subscription => {
        this.subscription = subscription;
        this.plan = PRICING_PLANS.find(plan => plan.key === subscription.key) ?? PRICING_PLANS[0];
        this.pendingDowngrade = subscription.pendingDowngrade;
        this.isFreePlan = this.subscription.key === PlanKeys.FREE;
        this.isLoading = false;

        this.route.queryParamMap
          .subscribe(params => {
            if (params.get('open') === 'pricing') {
              this.openPricingDrawer();
            }
          });
      },
      error: () => this.message.error('Failed to load current subscription. Please try again later.')
    });
  }

  get billingCycleLabel(): string {
    return this.subscription.billingCycle === BillingCycle.YEARLY ? 'Yearly billing' : 'Monthly billing';
  }

  get billingCycleSuffix(): string {
    return this.subscription.billingCycle === BillingCycle.YEARLY ? '/ year' : '/ month';
  }

  get mauUsed(): number {
    return this.subscription.usage?.mau || 0;
  }

  get mauUsagePercent(): number {
    return Math.round((this.mauUsed / this.subscription.totalMau) * 100);
  }

  get mauRemaining(): number {
    return Math.max(0, this.subscription.totalMau - this.mauUsed);
  }

  get isMauExceeded(): boolean {
    return this.subscription.totalMau < this.mauUsed;
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

  get currentBillingPeriod(): string {
    const start = this.subscription.currentPeriodStart;
    const end = subDays(this.subscription.currentPeriodEnd, 1); // Subtract 1 day to show the correct end date

    const startString = start ? formatDate(start, 'MMM d, y', 'en-US') : '';
    const endString = end ? formatDate(end, 'MMM d, y', 'en-US') : '';

    return `${startString} - ${endString}`;
  }

  get nextBillingDate(): string {
    const nextBillingDate = this.subscription.currentPeriodEnd;
    if (!nextBillingDate || this.isFreePlan) {
      return 'N/A';
    }

    return formatDate(nextBillingDate, 'MMM d, y', 'en-US');
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  pricingDrawerVisible = false;
  openPricingDrawer(): void {
    this.pricingDrawerVisible = true;
  }
  onClosePricingDrawer(subscriptionChanged: boolean): void {
    this.pricingDrawerVisible = false;

    if (subscriptionChanged) {
      // refresh the page to apply the latest subscription and license
      window.location.reload();
    }
  }
}
