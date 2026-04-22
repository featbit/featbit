import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  BillingCycle,
  EXTRA_MAU_PER_10K_COST,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanAction, PlanKeys,
  PRICING_PLANS,
  PricingPlan,
  UpdatePlanModalData
} from "@core/components/pricing-plans/types";
import { WorkspacePlan } from "@shared/types";
import { getCurrentPlan } from "@utils/project-env";

@Component({
  selector: 'pricing-plans',
  standalone: false,
  templateUrl: './pricing-plans.component.html',
  styleUrl: './pricing-plans.component.less'
})
export class PricingPlansComponent {
  private _visible: boolean = false;
  @Input()
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;

    if (value) {
      this.currentPlan = getCurrentPlan();

      PRICING_PLANS.forEach(p => {
        this.planMauSlider[p.key] = p.key === this.currentPlan.key
          ? this.currentPlan.totalMau
          : p.mauIncluded;
      });

      this.fineGrainedAcEnabled[this.currentPlan.key] = this.currentPlan.fineGrainedAcEnabled;
    }
  }

  @Output()
  close: EventEmitter<void> = new EventEmitter();

  currentPlan: WorkspacePlan = getCurrentPlan();
  isCurrentPlanChanged() {
    const isMauChanged = this.planMauSlider[this.currentPlan.key] !== this.currentPlan.totalMau;
    if (isMauChanged) {
      return true;
    }

    const isFineGrainedAcChanged =
      this.fineGrainedAcEnabled[this.currentPlan.key] !== this.currentPlan.fineGrainedAcEnabled;
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
    this.enterpriseBillingCycle = value as 'monthly' | 'yearly';
  }

  getPlanBasePrice(plan: PricingPlan): number {
    if (plan.key === PlanKeys.ENTERPRISE && this.enterpriseBillingCycle === 'yearly') {
      return 4490;
    }

    return plan.price;
  }

  getPlanTotalPrice(plan: PricingPlan): number {
    const selectedMau = this.planMauSlider[plan.key] || plan.mauIncluded;
    const extraMau = Math.max(0, selectedMau - plan.mauIncluded);
    const extraCost = (extraMau / 10_000) * EXTRA_MAU_PER_10K_COST;
    const fineGrainedAcCost = this.fineGrainedAcEnabled[plan.key] ? FINE_GRAINED_AC_PER_MONTH_PRICE : 0;

    if (plan.key === 'enterprise' && this.enterpriseBillingCycle === 'yearly') {
      return 4490 + (extraMau / 10000) * 20 + fineGrainedAcCost * 12;
    }
    return plan.price + extraCost + fineGrainedAcCost;
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

  // plan modal
  planModalVisible: boolean = false;
  planModalData: UpdatePlanModalData;
  updatePlan(newPlan: PricingPlan, action: PlanAction): void {
    this.planModalData = {
      action,
      currentPlan: { ...this.currentPlan },
      newPlan: {
        key: newPlan.key,
        name: newPlan.name,
        order: newPlan.order,
        includedMau: newPlan.mauIncluded,
        extraMau: Math.max(0, (this.planMauSlider[newPlan.key] || newPlan.mauIncluded) - newPlan.mauIncluded),
        totalMau: this.planMauSlider[newPlan.key] || newPlan.mauIncluded,
        fineGrainedAcEnabled: this.fineGrainedAcEnabled[newPlan.key] || false,
        price: this.getPlanTotalPrice(newPlan),
        billingCycle: newPlan.key === PlanKeys.ENTERPRISE ? this.enterpriseBillingCycle : BillingCycle.MONTHLY
      },
      basePrice: this.getPlanBasePrice(newPlan)
    };
    this.planModalVisible = true;
  }

  onUpdatePlanModalClose(confirmed: boolean) {
    this.planModalVisible = false;
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  onClose() {
    // reset states
    this.planMauSlider = {};
    this.fineGrainedAcEnabled = {};

    this.close.emit();
  }

  protected readonly normalPlans = PRICING_PLANS.slice(0, 3);
  protected readonly enterprisePlan = PRICING_PLANS[3];
  protected readonly fineGrainedAcPrice = FINE_GRAINED_AC_PER_MONTH_PRICE;
}
