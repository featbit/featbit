import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import {
  BillingCycle,
  EXTRA_MAU_PER_10K_PER_MONTH_PRICE,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  UpdateAction,
  PlanKeys,
  PRICING_PLANS,
  PricingPlan,
  UpdateSubscriptionModalData,
  ENTERPRISE_YEARLY_PRICE,
  EMPTY_SUBSCRIPTION
} from "@core/components/pricing-plans/types";
import { BillingService } from '@core/services/billing.service';
import { LicenseFeatureEnum, WorkspaceSubscription } from "@shared/types";
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize } from "rxjs/operators";

@Component({
  selector: 'pricing-plans',
  standalone: false,
  templateUrl: './pricing-plans.component.html',
  styleUrl: './pricing-plans.component.less'
})
export class PricingPlansComponent {
  billingService = inject(BillingService);
  message = inject(NzMessageService);

  @Input()
  visible: boolean = false;

  private _subscription: WorkspaceSubscription = EMPTY_SUBSCRIPTION;
  @Input()
  set subscription(value: WorkspaceSubscription) {
    if (!value) {
      return;
    }

    this._subscription = { ...value };
    this.initStats();
  }
  get subscription(): WorkspaceSubscription {
    return this._subscription;
  }

  @Output()
  close = new EventEmitter<boolean>();

  initStats() {
    const subscription = this._subscription;

    PRICING_PLANS.forEach(p => {
      this.planMauSlider[p.key] = p.key === subscription.key
        ? subscription.totalMau
        : p.mauIncluded;
    });

    this.fineGrainedAcEnabled[subscription.key] = subscription.fineGrainedAcEnabled;
    if (subscription.key === PlanKeys.ENTERPRISE) {
      this.enterpriseBillingCycle = subscription.billingCycle;
    }
  }

  canUpdateCurrentSubscription() {
    const isMauChanged = this.planMauSlider[this._subscription.key] !== this._subscription.totalMau;
    if (isMauChanged) {
      return true;
    }

    const isFineGrainedAcChanged =
      this.fineGrainedAcEnabled[this._subscription.key] !== this._subscription.fineGrainedAcEnabled;
    if (isFineGrainedAcChanged) {
      return true;
    }

    if (this._subscription.key !== PlanKeys.FREE && this._subscription.isLocal) {
      return true;
    }

    return false;
  }

  // per plan fine-grained access control toggle
  fineGrainedAcEnabled: { [key: string]: boolean } = {};
  // per plan MAU slider value
  planMauSlider: { [key: string]: number } = {};

  // Enterprise billing toggle
  enterpriseBillingCycle: string = BillingCycle.MONTHLY;
  billingCycleOptions = [
    { label: 'Monthly', value: BillingCycle.MONTHLY },
    { label: 'Yearly', value: BillingCycle.YEARLY },
  ];

  getPlanTotalPrice(plan: PricingPlan): number {
    const isEnterpriseYearly =
      plan.key === PlanKeys.ENTERPRISE && this.enterpriseBillingCycle === BillingCycle.YEARLY;

    const totalMonth = isEnterpriseYearly ? 12 : 1;

    const selectedMAU = this.planMauSlider[plan.key] || plan.mauIncluded;
    const extendedMAU = Math.max(0, selectedMAU - plan.mauIncluded);
    const extendedMAUCost = (extendedMAU / 10_000) * EXTRA_MAU_PER_10K_PER_MONTH_PRICE * totalMonth;

    const fineGrainedAcCost = this.fineGrainedAcEnabled[plan.key]
      ? FINE_GRAINED_AC_PER_MONTH_PRICE * totalMonth
      : 0;

    const basePrice = isEnterpriseYearly
      ? ENTERPRISE_YEARLY_PRICE
      : plan.price * totalMonth;

    return basePrice + extendedMAUCost + fineGrainedAcCost;
  }

  formatMau(val: number): string {
    return val >= 1000 ? `${val / 1000}K` : `${val}`;
  }

  getPlanMauLabel(plan: PricingPlan): string {
    const val = this.planMauSlider[plan.key] || plan.mauIncluded;
    return val >= 1000 ? `${(val / 1000)}K` : `${val}`;
  }

  getSliderMarks(plan: PricingPlan): { [key: number]: string } {
    return {
      [plan.mauIncluded]: this.formatMau(plan.mauIncluded),
      [plan.mauMax]: this.formatMau(plan.mauMax)
    };
  }

  // subscription update modal
  modalVisible: boolean = false;
  modalData: UpdateSubscriptionModalData = undefined;
  newSubscriptionKey: string = '';
  isCreatingSubscription: boolean = false;
  updateSubscription(newPlan: PricingPlan, action: UpdateAction): void {
    this.newSubscriptionKey = newPlan.key;
    const newSubscription = {
      plan: newPlan.key,
      billingCycle: newPlan.key === PlanKeys.ENTERPRISE ? this.enterpriseBillingCycle : BillingCycle.MONTHLY,
      mau: this.planMauSlider[newPlan.key] || newPlan.mauIncluded,
      addOnFeatures: this.fineGrainedAcEnabled[newPlan.key] ? [LicenseFeatureEnum.FineGrainedAccessControl] : []
    };

    // Local subscription (e.g., free plan or manually created), create a new subscription
    if (this._subscription.isLocal) {
      this.isCreatingSubscription = true;
      this.billingService.createSubscription(newSubscription)
      .pipe(finalize(() => this.isCreatingSubscription = false))
      .subscribe({
        next: (session) => {
          this.isCreatingSubscription = false;
          window.location.href = session.url;
        },
        error: () => this.message.error('Failed to create subscription. If the problem persists, please contact support.')
      });
    } else {
      const billingCycle = newPlan.key === PlanKeys.ENTERPRISE ? this.enterpriseBillingCycle : BillingCycle.MONTHLY;
      // paid -> paid, upgrade/downgrade subscription, show update modal
      this.modalData = {
        action,
        currentSubscription: { ...this._subscription },
        newSubscription: {
          key: newPlan.key,
          name: newPlan.name,
          description: newPlan.description,
          order: newPlan.order,
          includedMau: newPlan.mauIncluded,
          extraMau: Math.max(0, (this.planMauSlider[newPlan.key] || newPlan.mauIncluded) - newPlan.mauIncluded),
          totalMau: this.planMauSlider[newPlan.key] || newPlan.mauIncluded,
          fineGrainedAcEnabled: this.fineGrainedAcEnabled[newPlan.key] || false,
          basePrice: billingCycle === BillingCycle.MONTHLY
            ? newPlan.price
            : (newPlan.yearlyPrice ?? newPlan.price * 12),
          price: this.getPlanTotalPrice(newPlan),
          billingCycle: billingCycle,
          currentPeriodStart: this._subscription.currentPeriodStart,
          currentPeriodEnd: this._subscription.currentPeriodEnd,
          subscriberSince: this._subscription.subscriberSince,
          isLocal: false
        }
      };
      this.modalVisible = true;
    }
  }

  onUpdatePlanModalClose(confirmed: boolean) {
    this.modalVisible = false;
    this.newSubscriptionKey = '';
    this.modalData = undefined;
    this.isCreatingSubscription = false;

    if (confirmed) {
      this.close.emit(true);
    }
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  onClose(subscriptionChanged: boolean = false): void {
    // reset states
    this.initStats();
    this.close.emit(subscriptionChanged);
  }

  protected readonly normalPlans = PRICING_PLANS.slice(0, 3);
  protected readonly enterprisePlan = PRICING_PLANS[3];
  protected readonly fineGrainedAcPrice = FINE_GRAINED_AC_PER_MONTH_PRICE;
  protected readonly UpdateAction = UpdateAction;
}
