import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { environment } from 'src/environments/environment';
import { firstValueFrom } from "rxjs";
import { EndAuthorizationResponse, LogoutUserResponse, StartAuthorizationResponse } from "@shared/oauth/types";

// ref: https://github.com/curityio/spa-using-token-handler/blob/main/spa/src/oauth/oauthClient.ts

@Injectable({
  providedIn: 'root'
})
export class OauthAgentService {
  antiForgeryToken: string | null;

  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    return `${environment.url}/oauth-agent`;
  }

  /*
   * Complete a login from the authorization response returned to the browser
   */
  async loginEnd(pageUrl: string): Promise<EndAuthorizationResponse> {
    const url = `${this.baseUrl}/login/end`;
    const response = await firstValueFrom(this.http.post<EndAuthorizationResponse>(url, { pageUrl }, this.getOptions()));
    if (response && response.csrf) {
      this.antiForgeryToken = response.csrf;
    }
    return response;
  }

  /*
   * Pre-processing and download of the authorization request URL
   */
  async loginStart(): Promise<string> {
    const url = `${this.baseUrl}/login/start`;
    const response = await firstValueFrom(this.http.post<StartAuthorizationResponse>(url, {}, this.getOptions()));
    return response.authorizationRequestUrl;
  }

  /*
   * Get information about the user that the SPA needs to display
   */
  async getUserInfo(): Promise<any> {
    const url = `${this.baseUrl}/userInfo`;
    return await firstValueFrom(this.http.get(url, this.getOptions()));
  }

  /*
   * Get ID token claims from the API and return it to the UI for display
   */
  async getClaims(): Promise<any> {
    const url = `${this.baseUrl}/claims`;
    return await firstValueFrom(this.http.get(url, this.getOptions()));
  }

  /*
   * Refresh the tokens stored in secure cookies when an API returns a 401 response
   */
  async refresh(): Promise<void> {
    const url = `${this.baseUrl}/refresh`;
    await firstValueFrom(this.http.post(url, {}, this.getOptions()));
  }

  /*
   * Perform logout actions
   */
  async logout(): Promise<string> {
    const url = `${this.baseUrl}/logout`;
    const response = await firstValueFrom(this.http.post<LogoutUserResponse>(url, {}, this.getOptions()));
    this.antiForgeryToken = null;
    return response.url;
  }

  private getOptions() {
    const headers = new HttpHeaders({
      'accept': 'application/json',
      'content-type': 'application/json',
    });

    // Add anti forgery token if available
    if (this.antiForgeryToken) {
      headers.append('x-featbit-csrf', this.antiForgeryToken);
    }

    return {
      headers,
      withCredentials: true
    }
  }
}
