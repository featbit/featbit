import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from "src/environments/environment";
import { LicenseFeatureEnum, WorkspaceSubscription } from '@shared/types';
import {
  BillingInformation,
  CheckoutSession,
  InvoiceItem,
  Subscription
} from "@features/safe/workspaces/billing/types";
import { PRICING_PLANS } from "@core/components/pricing-plans/types";

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private baseUrl = `${environment.url}/api/v1/billing`;

  constructor(private http: HttpClient) {
  }

  createSubscription(): Observable<CheckoutSession> {
    return this.http.post<CheckoutSession>(`${this.baseUrl}/checkout`, {
      email: "lian.yang.work@gmail.com",
      plan: "pro",
      billingCycle: "month",
      mau: 10_000,
      extraFeatures: [ LicenseFeatureEnum.FineGrainedAccessControl ]
    });
  }

  getCurrentSubscription(): Observable<WorkspaceSubscription> {
    return this.http.get<string>(`${this.baseUrl}/subscription`).pipe(
      map(subscriptionJsonString => {
        const raw = JSON.parse(subscriptionJsonString);
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
        } as WorkspaceSubscription;
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
      map(billingInfoJsonString => JSON.parse(billingInfoJsonString) as BillingInformation)
    );
  }

  updateBillingInformation(payload: BillingInformation): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/billing-information`, payload);
  }

  getInvoices(): Observable<InvoiceItem[]> {
    return this.http.get<string>(`${this.baseUrl}/invoices`).pipe(
      map(invoicesJsonString => JSON.parse(invoicesJsonString) as InvoiceItem[])
    );
  }

  redirectToCheckout(url: string): void {
    window.location.href = url;
  }
}
