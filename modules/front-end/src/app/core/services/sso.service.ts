import { Injectable } from '@angular/core';
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class SsoService {
  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    return `${environment.url}/api/v1/sso`;
  }

  get redirectUri() {
    return `${location.origin}${location.pathname}?sso-logged-in=true`;
  }

  get authorizeUrl() {
    return `${this.baseUrl}/oidc-authorize-url?redirect_uri=${this.redirectUri}`;
  }

  isEnabled(): Promise<boolean> {
    return firstValueFrom(this.http.get<boolean>(`${this.baseUrl}/check-enabled`));
  }

  oidcLogin(code: string) {
    return this.http.post(`${this.baseUrl}/oidc/login`, { code, redirectUri: this.redirectUri });
  }
}
