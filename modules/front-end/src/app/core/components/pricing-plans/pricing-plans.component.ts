import { Component, EventEmitter, Input, Output } from '@angular/core';
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
import { WorkspaceSubscription } from "@shared/types";

@Component({
  selector: 'pricing-plans',
  standalone: false,
  templateUrl: './pricing-plans.component.html',
  styleUrl: './pricing-plans.component.less'
})
export class PricingPlansComponent {
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
  close: EventEmitter<void> = new EventEmitter();

  initStats() {
    const subscription = this._subscription;

    PRICING_PLANS.forEach(p => {
      this.planMauSlider[p.key] = p.key === subscription.key
        ? subscription.totalMau
        : p.mauIncluded;
    });

    this.fineGrainedAcEnabled[subscription.key] = subscription.fineGrainedAcEnabled;
  }

  isCurrentSubscriptionChanged() {
    const isMauChanged = this.planMauSlider[this._subscription.key] !== this._subscription.totalMau;
    if (isMauChanged) {
      return true;
    }

    const isFineGrainedAcChanged =
      this.fineGrainedAcEnabled[this._subscription.key] !== this._subscription.fineGrainedAcEnabled;
    if (isFineGrainedAcChanged) {
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

  onEnterpriseCycleChange(value: string | number): void {
    this.enterpriseBillingCycle = value as string;
  }

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
  modalData: UpdateSubscriptionModalData;
  updateSubscription(newPlan: PricingPlan, action: UpdateAction): void {
    this.modalData = {
      action,
      currentSubscription: { ...this._subscription },
      newSubscription: {
        key: newPlan.key,
        name: newPlan.name,
        order: newPlan.order,
        includedMau: newPlan.mauIncluded,
        extraMau: Math.max(0, (this.planMauSlider[newPlan.key] || newPlan.mauIncluded) - newPlan.mauIncluded),
        totalMau: this.planMauSlider[newPlan.key] || newPlan.mauIncluded,
        fineGrainedAcEnabled: this.fineGrainedAcEnabled[newPlan.key] || false,
        price: this.getPlanTotalPrice(newPlan),
        billingCycle: newPlan.key === PlanKeys.ENTERPRISE ? this.enterpriseBillingCycle : BillingCycle.MONTHLY,
        subscriberSince: this._subscription.subscriberSince
      }
    };
    this.modalVisible = true;
  }

  onUpdatePlanModalClose(confirmed: boolean) {
    this.modalVisible = false;
    if (confirmed) {
      console.log('Proceed with subscription update:', this.modalData);
    }
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  onClose() {
    // reset states
    this.initStats();
    this.close.emit();
  }

  protected readonly normalPlans = PRICING_PLANS.slice(0, 3);
  protected readonly enterprisePlan = PRICING_PLANS[3];
  protected readonly fineGrainedAcPrice = FINE_GRAINED_AC_PER_MONTH_PRICE;
  protected readonly UpdateAction = UpdateAction;
}
