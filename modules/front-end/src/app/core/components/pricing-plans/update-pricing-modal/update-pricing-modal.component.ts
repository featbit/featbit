import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  EXTRA_MAU_PER_10K_COST,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanAction,
  UpdatePlanModalData
} from '@core/components/pricing-plans/types';
import { WorkspaceSubscription } from "@shared/types";

interface PlanNote {
  icon: string;
  title: string;
  description: string;
}

const EMPTY_PLAN: WorkspaceSubscription = {
  key: '',
  name: '',
  order: 0,
  includedMau: 0,
  extraMau: 0,
  totalMau: 0,
  fineGrainedAcEnabled: false,
  price: 0,
  billingCycle: 'monthly'
};

@Component({
  selector: 'update-pricing-modal',
  standalone: false,
  templateUrl: './update-pricing-modal.component.html',
  styleUrl: './update-pricing-modal.component.less'
})
export class UpdatePricingModalComponent {
  @Input()
  visible: boolean;

  @Input()
  set data(value: UpdatePlanModalData) {
    if (value) {
      this.action = value.action;
      this.currentPlan = value.currentPlan;
      this.plan = value.newPlan;
      this.basePrice = value.basePrice;
      this.title = this.action === 'upgrade'
        ? $localize`:@@pricing.upgrade-plan-title:Upgrade Plan`
        : this.action === 'downgrade'
          ? $localize`:@@pricing.downgrade-plan-title:Downgrade Plan`
          : $localize`:@@pricing.update-plan-title:Update Plan`;
    }
  }

  @Output()
  close = new EventEmitter<boolean>();

  title: string;
  action: PlanAction = 'upgrade';
  currentPlan: WorkspaceSubscription = { ...EMPTY_PLAN };
  plan: WorkspaceSubscription = { ...EMPTY_PLAN };
  basePrice = 0;

  today = new Date();

  get formattedToday(): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(this.today);
  }

  get billingCycleLabel(): string {
    return this.plan.billingCycle === 'yearly' ? 'year' : 'month';
  }

  get currentBillingCycleLabel(): string {
    return this.currentPlan.billingCycle === 'yearly' ? 'year' : 'month';
  }

  get billingCycleTag(): string {
    return this.plan.billingCycle === 'yearly' ? 'Billed annually' : 'Billed monthly';
  }

  get actionLabel(): string {
    return this.action === 'upgrade'
      ? 'Upgrade preview'
      : this.action === 'downgrade'
        ? 'Downgrade preview'
        : 'Plan change preview';
  }

  get titleSubtitle(): string {
    return this.action === 'upgrade'
      ? 'Review what unlocks now and what your recurring total will look like.'
      : this.action === 'downgrade'
        ? 'See what stays active until renewal and what changes on your next cycle.'
        : 'Confirm the new configuration before we apply it to your workspace.';
  }

  get transitionHeadline(): string {
    if (!this.currentPlan.name) {
      return this.plan.name;
    }

    return `${this.currentPlan.name} to ${this.plan.name}`;
  }

  get actionDescription(): string {
    return this.action === 'upgrade'
      ? 'Your workspace will move to the new plan immediately after confirmation. Any proration is calculated separately at checkout.'
      : this.action === 'downgrade'
        ? 'Your current access remains in place until renewal, then the new recurring total takes over on the next cycle.'
        : 'We will keep the same plan tier and apply the new billing configuration to the rest of the current cycle.';
  }

  get effectiveDateTitle(): string {
    return this.action === 'downgrade' ? 'At next renewal' : 'Immediately after confirmation';
  }

  get effectiveDateDescription(): string {
    return this.action === 'downgrade'
      ? 'No features are removed before the current billing cycle ends.'
      : `Starts today, ${this.formattedToday}`;
  }

  get formattedMau(): string {
    const totalMau = this.plan.totalMau;
    return totalMau >= 1000 ? `${totalMau / 1000}K` : `${totalMau}`;
  }

  get formattedExtraMau(): string {
    const extraMau = this.plan.extraMau;
    return extraMau >= 1000 ? `${extraMau / 1000}K MAU` : `${extraMau} MAU`;
  }

  get extraMauMonthlyCost(): number {
    return this.plan.totalMau > this.plan.includedMau
      ? (this.plan.extraMau / 10000) * EXTRA_MAU_PER_10K_COST
      : 0;
  }

  get billingMultiplier(): number {
    return this.plan.billingCycle === 'yearly' ? 12 : 1;
  }

  get extraMauRecurringCost(): number {
    return this.extraMauMonthlyCost * this.billingMultiplier;
  }

  get fineGrainedAcRecurringCost(): number {
    return this.plan.fineGrainedAcEnabled ? FINE_GRAINED_AC_PER_MONTH_PRICE * this.billingMultiplier : 0;
  }

  get recurringTotal(): number {
    return this.plan.price;
  }

  get summaryTotalLabel(): string {
    return this.action === 'downgrade' ? 'Next cycle total' : 'New recurring total';
  }

  get todayImpactTitle(): string {
    return this.action === 'downgrade' ? 'No payment is collected today' : 'Proration is calculated at checkout';
  }

  get todayImpactDescription(): string {
    return this.action === 'upgrade'
      ? 'You may see a prorated charge for the remaining time in the current billing cycle.'
      : this.action === 'downgrade'
        ? 'Your current charges stay in place until the next billing cycle begins.'
        : 'Any prorated charge or credit depends on the difference between your current and new configuration.';
  }

  get confirmButtonText(): string {
    return this.action === 'upgrade'
      ? 'Confirm Upgrade'
      : this.action === 'downgrade'
        ? 'Schedule Downgrade'
        : 'Confirm Changes';
  }

  get noteItems(): PlanNote[] {
    if (this.action === 'upgrade') {
      return [
        {
          icon: 'thunderbolt',
          title: 'New limits and features unlock right away',
          description: 'Your team can start using the upgraded plan as soon as the change is confirmed.'
        },
        {
          icon: 'credit-card',
          title: 'You only pay the difference for the rest of this cycle',
          description: 'We calculate any immediate prorated charge separately from the recurring amount shown here.'
        },
        {
          icon: 'calendar',
          title: 'Your new recurring total starts with the new cycle',
          description: 'Future invoices will follow the billing cadence selected for this plan.'
        }
      ];
    }

    if (this.action === 'downgrade') {
      return [
        {
          icon: 'clock-circle',
          title: 'Nothing changes until the current cycle ends',
          description: 'Your current workspace access and paid features remain active until renewal.'
        },
        {
          icon: 'swap',
          title: 'The new price starts on the next invoice',
          description: 'The recurring total in the summary becomes active when the next billing cycle begins.'
        },
        {
          icon: 'check-circle',
          title: 'You can still review usage before the switch',
          description: 'The selected MAU and add-ons are captured so the lower tier matches what you expect at renewal.'
        }
      ];
    }

    return [
      {
        icon: 'swap',
        title: 'Your plan tier stays the same',
        description: 'Only the selected usage or add-on configuration is changing for the remainder of the cycle.'
      },
      {
        icon: 'credit-card',
        title: 'A prorated adjustment may appear today',
        description: 'If the new configuration costs more or less, we apply a prorated charge or credit automatically.'
      },
      {
        icon: 'calendar',
        title: 'Your recurring total updates after confirmation',
        description: 'The amount below becomes the ongoing recurring price for future billing cycles.'
      }
    ];
  }

  onClose(confirmed: boolean) {
    this.close.emit(confirmed);
  }
}
