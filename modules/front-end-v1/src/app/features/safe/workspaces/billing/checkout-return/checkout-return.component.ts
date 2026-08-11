import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { BillingService } from "@services/billing.service";

type ViewState = 'canceled' | 'verifying' | 'success' | 'failure';
const AUTO_REDIRECT_DELAY_SECONDS = 3;
const POLLING_INTERVAL_SECONDS = 2;
const VERIFICATION_TIMEOUT_SECONDS = 15;

@Component({
  selector: 'checkout-return',
  standalone: false,
  templateUrl: './checkout-return.component.html',
  styleUrl: './checkout-return.component.less'
})
export class CheckoutReturnComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billingService = inject(BillingService);

  viewState: ViewState = 'verifying';

  readonly verificationTotalSeconds = VERIFICATION_TIMEOUT_SECONDS;
  remainingVerificationSeconds = VERIFICATION_TIMEOUT_SECONDS;

  readonly redirectTotalSeconds = AUTO_REDIRECT_DELAY_SECONDS;
  redirectRemainingSeconds = AUTO_REDIRECT_DELAY_SECONDS;

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoRedirectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const paymentStatus = this.route.snapshot.queryParams['payment_status'];
    if (paymentStatus === 'succeeded') {
      this.viewState = 'verifying';
      this.startVerification();
    } else {
      this.viewState = 'canceled';
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  startVerification(): void {
    this.remainingVerificationSeconds = this.verificationTotalSeconds;
    this.redirectRemainingSeconds = this.redirectTotalSeconds;
    this.viewState = 'verifying';
    this.clearTimers();

    this.countdownIntervalId = setInterval(() => {
      this.remainingVerificationSeconds--;
      if (this.remainingVerificationSeconds <= 0) {
        this.clearTimers();
        this.viewState = 'failure';
      }
    }, 1000);

    this.pollingIntervalId = setInterval(() => {
      this.billingService.getLicense().subscribe({
        next: (license) => {
          if (license.plan !== 'free' && license.status === 'active') {
            this.clearTimers();
            this.viewState = 'success';
            this.redirectRemainingSeconds = this.redirectTotalSeconds;
            this.countdownIntervalId = setInterval(() => {
              this.redirectRemainingSeconds--;
              if (this.redirectRemainingSeconds <= 0) {
                this.redirectRemainingSeconds = 0;
                if (this.countdownIntervalId !== null) {
                  clearInterval(this.countdownIntervalId);
                  this.countdownIntervalId = null;
                }
              }
            }, 1000);
            this.autoRedirectTimeoutId = setTimeout(() => {
              if (this.viewState === 'success') {
                this.refreshToBilling();
              }
            }, AUTO_REDIRECT_DELAY_SECONDS * 1000);
          }
        },
        error: () => { /* silently ignore polling errors */ }
      });
    }, POLLING_INTERVAL_SECONDS * 1000);
  }

  private clearTimers(): void {
    if (this.pollingIntervalId !== null) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    if (this.autoRedirectTimeoutId !== null) {
      clearTimeout(this.autoRedirectTimeoutId);
      this.autoRedirectTimeoutId = null;
    }
  }

  refreshToBilling(): void {
    this.clearTimers();
    this.router.navigate(['/workspace/billing'], { replaceUrl: true }).then(() => {
      window.location.reload();
    });
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }
}
