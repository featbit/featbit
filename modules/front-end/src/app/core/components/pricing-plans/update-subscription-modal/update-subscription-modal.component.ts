import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  BillingCycle, EMPTY_SUBSCRIPTION,
  EXTRA_MAU_PER_10K_PER_MONTH_PRICE,
  FINE_GRAINED_AC_PER_MONTH_PRICE, PlanKeys, PRICING_PLANS,
  UpdateAction,
  UpdateSubscriptionModalData
} from '@core/components/pricing-plans/types';
import { WorkspaceSubscription } from "@shared/types";

interface SubscriptionNote {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'update-subscription-modal',
  standalone: false,
  templateUrl: './update-subscription-modal.component.html',
  styleUrl: './update-subscription-modal.component.less'
})
export class UpdateSubscriptionModalComponent {
  @Input()
  visible: boolean;

  @Input()
  set data(value: UpdateSubscriptionModalData) {
    if (value) {
      this.action = value.action;
      this.currentSubscription = value.currentSubscription;
      this.newSubscription = value.newSubscription;
      this.title = this.action === UpdateAction.UPGRADE
        ? "Upgrade Subscription"
        : this.action === UpdateAction.DOWNGRADE
          ? "Downgrade Subscription"
          : "Update Subscription";
    }
  }

  @Output()
  close = new EventEmitter<boolean>();

  title: string;
  action: UpdateAction = UpdateAction.UPDATE;
  currentSubscription: WorkspaceSubscription = EMPTY_SUBSCRIPTION;
  newSubscription: WorkspaceSubscription = EMPTY_SUBSCRIPTION;

  get newBasePrice(): number {
    const plan = PRICING_PLANS.find(p => p.key === this.newSubscription.key);
    if (plan.key === PlanKeys.ENTERPRISE && this.newSubscription.billingCycle === BillingCycle.YEARLY) {
      return 4490;
    }

    return plan.price;
  }

  get billingCycleTag(): string {
    return this.newSubscription.billingCycle === BillingCycle.YEARLY ? 'Billed annually' : 'Billed monthly';
  }

  get titleSubtitle(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'Review what unlocks now and what your recurring total will look like.'
      : this.action === UpdateAction.DOWNGRADE
        ? 'See what stays active until renewal and what changes on your next cycle.'
        : 'Confirm the new configuration before we apply it to your workspace.';
  }

  get transitionHeadline(): string {
    if (!this.currentSubscription.name) {
      return this.newSubscription.name;
    }

    return `${this.currentSubscription.name} to ${this.newSubscription.name}`;
  }

  get actionDescription(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'Your workspace will move to the new plan immediately after confirmation. Any proration is calculated separately at checkout.'
      : this.action === UpdateAction.DOWNGRADE
        ? 'Your current access remains in place until renewal, then the new recurring total takes over on the next cycle.'
        : 'We will keep the same plan tier and apply the new billing configuration to the rest of the current cycle.';
  }

  get formattedExtraMau(): string {
    const extraMau = this.newSubscription.extraMau;
    return extraMau >= 1000 ? `${extraMau / 1000}K MAU` : `${extraMau} MAU`;
  }

  get extraMauMonthlyCost(): number {
    return this.newSubscription.totalMau > this.newSubscription.includedMau
      ? (this.newSubscription.extraMau / 10000) * EXTRA_MAU_PER_10K_PER_MONTH_PRICE
      : 0;
  }

  get billingMultiplier(): number {
    return this.newSubscription.billingCycle === BillingCycle.YEARLY ? 12 : 1;
  }

  get extraMauRecurringCost(): number {
    return this.extraMauMonthlyCost * this.billingMultiplier;
  }

  get fineGrainedAcRecurringCost(): number {
    return this.newSubscription.fineGrainedAcEnabled ? FINE_GRAINED_AC_PER_MONTH_PRICE * this.billingMultiplier : 0;
  }

  get summaryTotalLabel(): string {
    return this.action === UpdateAction.DOWNGRADE ? 'Next cycle total' : 'New recurring total';
  }

  get todayImpactTitle(): string {
    return this.action === UpdateAction.DOWNGRADE ? 'No payment is collected today' : 'Proration is calculated at checkout';
  }

  get todayImpactDescription(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'You may see a prorated charge for the remaining time in the current billing cycle.'
      : this.action === UpdateAction.DOWNGRADE
        ? 'Your current charges stay in place until the next billing cycle begins.'
        : 'Any prorated charge or credit depends on the difference between your current and new configuration.';
  }

  get confirmButtonText(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'Confirm Upgrade'
      : this.action === UpdateAction.DOWNGRADE
        ? 'Schedule Downgrade'
        : 'Confirm Changes';
  }

  get noteItems(): SubscriptionNote[] {
    if (this.action === UpdateAction.UPGRADE) {
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

    if (this.action === UpdateAction.DOWNGRADE) {
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
