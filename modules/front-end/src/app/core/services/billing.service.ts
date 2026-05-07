import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from "src/environments/environment";
import { LicenseFeatureEnum, WorkspaceSubscription } from '@shared/types';
import {
  BillingCycle,
  BillingInformation,
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
        return {
          key: plan.key,
          name: plan.name,
          order: plan.order,
          includedMau: raw.baseMau,
          extraMau: raw.mau - raw.baseMau,
          totalMau: raw.mau,
          fineGrainedAcEnabled: (raw.addOnFeatures as string[]).includes(LicenseFeatureEnum.FineGrainedAccessControl),
          price: parseFloat(raw.unitAmount),
          billingCycle: raw.billingCycle,
          currentPeriodStart: raw.currentPeriodStart ? new Date(raw.currentPeriodStart) : undefined,
          currentPeriodEnd: raw.currentPeriodEnd ? new Date(raw.currentPeriodEnd) : undefined,
          subscriberSince: raw.createdAt ? new Date(raw.createdAt) : undefined,
          usage: raw.usage
        } as WorkspaceSubscription;
      })
    );
  }

  getCurrentBillingCycle(): Observable<BillingCycle> {
    return this.http.get<string>(`${this.baseUrl}/current-cycle`).pipe(
      map(billingCycleJsonString => JSON.parse(billingCycleJsonString) as BillingCycle)
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

  upgradeSubscription(subscription: Subscription): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/subscription/upgrade`, subscription);
  }

  downgradeSubscription(subscription: Subscription): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/subscription/downgrade`, subscription);
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
