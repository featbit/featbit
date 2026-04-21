import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PRICING_PLANS, PricingPlan } from "@core/components/pricing-plans/types";
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

      this.fineGrainedAcEnabled[this.currentPlan.key] = this.currentPlan.addons.includes('fineGrainedAccessControl');
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

    const isFineGrainedAcChanged = this.fineGrainedAcEnabled[this.currentPlan.key] !== this.currentPlan.addons.includes('fineGrainedAccessControl');
    if (isFineGrainedAcChanged) {
      return true;
    }

    return false;
  }

  // Add-ons
  fineGrainedAcPrice = 60;
  fineGrainedAcEnabled: { [key: string]: boolean } = {};

  // Enterprise billing toggle
  enterpriseBillingCycle: 'monthly' | 'yearly' = 'monthly';
  billingCycleOptions = [
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  onEnterpriseCycleChange(value: string | number): void {
    this.enterpriseBillingCycle = value as 'monthly' | 'yearly';
  }

  // MAU slider values per plan
  planMauSlider: { [key: string]: number } = {};

  getPlanTotal(plan: PricingPlan): number {
    const selectedMau = this.planMauSlider[plan.key] || plan.mauIncluded;
    const extraMau = Math.max(0, selectedMau - plan.mauIncluded);
    const extraCost = (extraMau / 10000) * plan.extraMauCost;
    const addonCost = this.fineGrainedAcEnabled[plan.key] ? this.fineGrainedAcPrice : 0;

    if (plan.key === 'enterprise' && this.enterpriseBillingCycle === 'yearly') {
      return 4490 + (extraMau / 10000) * 20 + addonCost * 12;
    }
    return plan.price + extraCost + addonCost;
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

  isDowngrade(plan: PricingPlan): boolean {
    return plan.order < this.currentPlan.order;
  }

  selectPlan(planKey: string): void {
    // In real implementation, this would call the API
    console.log('Selected plan:', planKey);
  }

  updatePlan(): void {
    // In real implementation, this would call the API to update MAU/addons
    console.log('Update current plan:', this.currentPlan.key);
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  onClose() {
    this.close.emit();
  }

  protected readonly normalPlans = PRICING_PLANS.slice(0, 3);
  protected readonly enterprisePlan = PRICING_PLANS[3];
}
