import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from "src/environments/environment";
import { LicenseFeatureEnum, WorkspaceSubscription } from '@shared/types';
import {
  BillingCycle,
  BillingInformation,
  BillingLicense,
  CheckoutSession,
  InvoiceItem,
  Subscription
} from "@features/safe/workspaces/billing/types";
import { PRICING_PLANS, ProrationPreview } from "@core/components/pricing-plans/types";

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private baseUrl = `${environment.url}/api/v1/billing`;

  constructor(private http: HttpClient) {
  }

  getCurrentSubscription(): Observable<WorkspaceSubscription> {
    return this.http.get<string>(`${this.baseUrl}/subscription`).pipe(
      map(subscriptionJsonString => {
        const raw = JSON.parse(subscriptionJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch current subscription');
        }

        const plan = PRICING_PLANS.find(p => p.key === raw.plan);
        if (!plan) {
          throw new Error(`Unknown subscription plan: ${raw.plan}`);
        }

        return {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          order: plan.order,
          includedMau: raw.baseMau,
          extraMau: raw.mau - raw.baseMau,
          totalMau: raw.mau,
          fineGrainedAcEnabled: (raw.addOnFeatures as string[]).includes(LicenseFeatureEnum.FineGrainedAccessControl),
          basePrice: raw.billingCycle === 'month' ? plan.price : plan.yearlyPrice!,
          price: parseFloat(raw.unitAmount) / 100.0,
          billingCycle: raw.billingCycle,
          currentPeriodStart: new Date(raw.currentPeriodStart),
          currentPeriodEnd: new Date(raw.currentPeriodEnd),
          subscriberSince: new Date(raw.createdAt),
          usage: raw.usage,
          pendingDowngrade: raw.pendingDowngrade,
        };
      })
    );
  }

  getCurrentBillingCycle(): Observable<BillingCycle> {
    return this.http.get<string>(`${this.baseUrl}/current-cycle`).pipe(
      map(billingCycleJsonString => {
        const raw = JSON.parse(billingCycleJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch current billing cycle');
        }

        return {
          startDate: new Date(raw.startDate),
          endDate: new Date(raw.endDate),
        };
      })
    );
  }

  createSubscription(subscription: Subscription): Observable<CheckoutSession> {
    return this.http.post<string>(`${this.baseUrl}/subscription`, subscription).pipe(
      map(checkoutSessionJsonString => {
        const raw = JSON.parse(checkoutSessionJsonString);
        if (raw === null) {
          throw new Error('Failed to create subscription');
        }

        return raw;
      })
    );
  }

  getProrationPreview(subscription: Subscription): Observable<ProrationPreview> {
    return this.http.post<string>(`${this.baseUrl}/subscription/proration-preview`, subscription).pipe(
      map(prorationPreviewJsonString => {
        const raw = JSON.parse(prorationPreviewJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch proration preview');
        }

        return raw;
      })
    );
  }

  upgradeSubscription(subscription: Subscription) {
    return this.http.post<string>(`${this.baseUrl}/subscription/upgrade`, subscription).pipe(
      map(responseJsonString => {
        const raw = JSON.parse(responseJsonString);
        if (raw === null) {
          throw new Error('Failed to upgrade subscription');
        }

        return raw;
      })
    );
  }

  downgradeSubscription(subscription: Subscription) {
    return this.http.post<string>(`${this.baseUrl}/subscription/downgrade`, subscription).pipe(
      map(responseJsonString => {
        const raw = JSON.parse(responseJsonString);
        if (raw === null) {
          throw new Error('Failed to downgrade subscription');
        }

        return raw;
      })
    );
  }

  getLicense(): Observable<BillingLicense> {
    return this.http.get<string>(`${this.baseUrl}/license`).pipe(
      map(licenseJsonString => {
        const raw = JSON.parse(licenseJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch license');
        }

        return raw;
      })
    );
  }

  getBillingInformation(): Observable<BillingInformation> {
    return this.http.get<string>(`${this.baseUrl}/billing-information`).pipe(
      map(billingInfoJsonString => {
        const raw = JSON.parse(billingInfoJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch billing information');
        }

        return raw;
      })
    );
  }

  updateBillingInformation(payload: BillingInformation): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/billing-information`, payload);
  }

  getInvoices(): Observable<InvoiceItem[]> {
    return this.http.get<string>(`${this.baseUrl}/invoices`).pipe(
      map(invoicesJsonString => {
        const raw = JSON.parse(invoicesJsonString);
        if (raw === null) {
          throw new Error('Failed to fetch invoices');
        }

        return raw;
      })
    );
  }
}
