import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CheckoutSession {
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class CheckoutService {
  private baseUrl = `${environment.url}/api/v1/checkout`;

  constructor(private http: HttpClient) {}

  createCheckoutSession(): Observable<CheckoutSession> {
    return this.http.post<CheckoutSession>(`${this.baseUrl}/session`, {});
  }

  redirectToCheckout(url: string): void {
    window.location.href = url;
  }
}
