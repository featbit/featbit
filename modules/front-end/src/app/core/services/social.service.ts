import { Injectable } from '@angular/core';
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { OAuthProvider } from "@shared/types";

@Injectable({
  providedIn: 'root'
})
export class SocialService {
  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    return `${environment.url}/api/v1/social`;
  }

  get redirectUri() {
    return `${location.origin}${location.pathname}?social-logged-in=true`;
  }

  async getProviders() {
    const result= await firstValueFrom(this.http.get<any[]>(`${this.baseUrl}/providers`));
    return result.map((provider: any) => new OAuthProvider(provider.name, provider.clientId));
  }

  isEnabled(): Promise<boolean> {
    return firstValueFrom(this.http.get<boolean>(`${this.baseUrl}/check-enabled`));
  }

  login(code: string, providerName: string) {
    return this.http.post(`${this.baseUrl}/login`, { code, providerName, redirectUri: this.redirectUri });
  }
}
