import { Injectable } from '@angular/core';
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { OAuthProvider, OAuthProviderEnum } from "@shared/types";

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

  async getProviders(): Promise<OAuthProvider[]> {
    const providers = await firstValueFrom(this.http.get<OAuthProvider[]>(`${this.baseUrl}/providers?redirectUri=${this.redirectUri}`));

    for (const provider of providers) {
      if (provider.name === OAuthProviderEnum.Google) {
        provider.icon = 'google';
      }

      if (provider.name === OAuthProviderEnum.GitHub) {
        provider.icon = 'github';
      }
    }

    return providers;
  }

  login(code: string, providerName: string) {
    return this.http.post(`${this.baseUrl}/login`, {code, providerName, redirectUri: this.redirectUri});
  }
}
