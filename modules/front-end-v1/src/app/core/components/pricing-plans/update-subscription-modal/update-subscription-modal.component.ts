import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import {
  BillingCycle,
  EMPTY_SUBSCRIPTION,
  ENTERPRISE_YEARLY_PRICE,
  EXTRA_MAU_PER_10K_PER_MONTH_PRICE,
  FINE_GRAINED_AC_PER_MONTH_PRICE,
  PlanKeys,
  PRICING_PLANS,
  ProrationPreview,
  UpdateAction,
  UpdateSubscriptionModalData
} from '@core/components/pricing-plans/types';
import { LicenseFeatureEnum, WorkspaceSubscription } from "@shared/types";
import { BillingService } from '@core/services/billing.service';
import { Subscription as BillingSubscriptionPayload } from '@features/safe/workspaces/billing/types';
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize } from "rxjs/operators";

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
  billingService = inject(BillingService);
  message = inject(NzMessageService);

  @Input()
  visible: boolean;

  @Input()
  set data(value: UpdateSubscriptionModalData) {
    if (value) {
      const { action, currentSubscription, newSubscription } = value;

      // If the action is explicitly set to UPDATE, we determine whether it's an upgrade or downgrade based on the
      // price difference between the current and new subscription.
      this.action = action === UpdateAction.UPDATE ?
        (newSubscription.price > currentSubscription.price ? UpdateAction.UPGRADE : UpdateAction.DOWNGRADE)
        : action;

      this.currentSubscription = currentSubscription;
      this.newSubscription = newSubscription;
      this.title = this.action === UpdateAction.UPGRADE
        ? "Upgrade Subscription"
        : "Downgrade Subscription";

      this.prorationPreview = null;
      this.isLoadingProration = false;
      this.prorationLoadError = false;
      if (this.action === UpdateAction.UPGRADE) {
        this.loadProrationPreview();
      }
    }
  }

  @Output()
  close = new EventEmitter<boolean>();

  title: string;
  action: UpdateAction.UPGRADE | UpdateAction.DOWNGRADE = UpdateAction.UPGRADE;
  currentSubscription: WorkspaceSubscription = EMPTY_SUBSCRIPTION;
  newSubscription: WorkspaceSubscription = EMPTY_SUBSCRIPTION;

  prorationPreview: ProrationPreview | null = null;
  isLoadingProration = false;
  prorationLoadError = false;

  loadProrationPreview() {
    this.isLoadingProration = true;
    this.prorationPreview = null;
    this.prorationLoadError = false;

    const { key, billingCycle, totalMau, fineGrainedAcEnabled } = this.newSubscription;

    const payload: BillingSubscriptionPayload = {
      plan: key,
      billingCycle: billingCycle,
      mau: totalMau,
      addOnFeatures: fineGrainedAcEnabled ? [ LicenseFeatureEnum.FineGrainedAccessControl ] : []
    };

    this.billingService.getProrationPreview(payload).subscribe({
      next: (preview) => {
        this.prorationPreview = preview;
        this.isLoadingProration = false;
      },
      error: () => {
        this.isLoadingProration = false;
        this.prorationLoadError = true;
      }
    });
  }

  get newBasePrice(): number {
    const plan = PRICING_PLANS.find(p => p.key === this.newSubscription.key);
    if (!plan) {
      return 0;
    }

    if (plan.key === PlanKeys.ENTERPRISE && this.newSubscription.billingCycle === BillingCycle.YEARLY) {
      return ENTERPRISE_YEARLY_PRICE;
    }

    return plan.price;
  }

  get billingCycleTag(): string {
    return this.newSubscription.billingCycle === BillingCycle.YEARLY ? 'Billed annually' : 'Billed monthly';
  }

  get titleSubtitle(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'Review what unlocks now and what your recurring total will look like.'
      : 'See what stays active until renewal and what changes on your next cycle.';
  }

  get transitionHeadline(): string {
    if (this.currentSubscription.key === this.newSubscription.key) {
      return 'Your plan configuration is changing';
    }

    return `${this.currentSubscription.name} to ${this.newSubscription.name}`;
  }

  get actionDescription(): string {
    return this.action === UpdateAction.UPGRADE
      ? 'Your workspace will move to the new plan immediately after confirmation. Any proration is calculated separately at checkout.'
      : 'Your current access remains in place until renewal, then the new recurring total takes over on the next cycle.';
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

  get confirmButtonText(): string {
    return this.action === UpdateAction.UPGRADE ? 'Confirm Upgrade' : 'Schedule Downgrade';
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

    return [];
  }

  isConfirming: boolean = false;
  confirmAction() {
    this.isConfirming = true;

    const subscriptionPayload = {
      plan: this.newSubscription.key,
      billingCycle: this.newSubscription.billingCycle,
      mau: this.newSubscription.totalMau,
      addOnFeatures: this.newSubscription.fineGrainedAcEnabled ? [ LicenseFeatureEnum.FineGrainedAccessControl ] : []
    }

    if (this.action === UpdateAction.UPGRADE) {
      this.billingService.upgradeSubscription(subscriptionPayload)
      .pipe(finalize(() => this.isConfirming = false))
      .subscribe({
        next: () => {
          sessionStorage.setItem('billingNotification', JSON.stringify({
            title: 'Subscription Upgraded',
            message: 'Your workspace has been upgraded to the new plan. New limits and features are now available immediately.'
          }));
          this.close.emit(true);
        },
        error: () => this.message.error('Failed to upgrade subscription. If the problem persists, please contact support.')
      });
    } else {
      this.billingService.downgradeSubscription(subscriptionPayload)
      .pipe(finalize(() => this.isConfirming = false))
      .subscribe({
        next: () => {
          sessionStorage.setItem('billingNotification', JSON.stringify({
            title: 'Downgrade Scheduled',
            message: 'Your current access remains active until renewal. The new configuration will take effect on your next billing cycle.'
          }));
          this.close.emit(true);
        },
        error: () => this.message.error('Failed to downgrade subscription. If the problem persists, please contact support.'),
      });
    }
  }

  onClose(confirmed: boolean = false) {
    this.close.emit(confirmed);
  }

  protected readonly UpdateAction = UpdateAction;
}
