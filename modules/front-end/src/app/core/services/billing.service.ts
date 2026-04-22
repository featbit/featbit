import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "src/environments/environment";
import { LicenseFeatureEnum } from '@shared/types';

export interface CheckoutSession {
  url: string;
}

export interface CreateCheckoutSessionPayload {
  email: string,
  plan: string,
  billingCycle: string,
  mau: number,
  extraFeatures: LicenseFeatureEnum[],
}

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private baseUrl = `${environment.url}/api/v1/billing`;

  constructor(private http: HttpClient) {}

  createCheckoutSession(): Observable<CheckoutSession> {
    return this.http.post<CheckoutSession>(`${this.baseUrl}/checkout`, {
      email: "lian.yang.work@gmail.com",
      plan: "pro",
      billingCycle: "month",
      mau: 10_000,
      extraFeatures: [LicenseFeatureEnum.FineGrainedAccessControl]
    });
  }

  redirectToCheckout(url: string): void {
    window.location.href = url;
  }
}
