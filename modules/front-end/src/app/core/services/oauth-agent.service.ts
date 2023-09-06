import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { environment } from 'src/environments/environment';
import { ErrorHandler } from "@shared/oauth/errorHandler";
import { RemoteError } from "@shared/oauth/remoteError";
import { catchError } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

// ref: https://github.com/curityio/spa-using-token-handler/blob/main/spa/src/oauth/oauthClient.ts

@Injectable({
  providedIn: 'root'
})
export class OauthAgentService {
  constructor(private http: HttpClient) {
  }

  antiForgeryToken: string | null;

  get baseUrl() {
    return `${environment.url}/oauth-agent`;
  }

  /*
     * The anti forgery token is made available to the API client during API calls
     */
  getAntiForgeryToken(): string | null {
    return this.antiForgeryToken;
  }

  /*
   * On every page load the SPA asks the OAuth Agent for login related state
   */
  async handlePageLoad(pageUrl: string): Promise<any> {

    const request = JSON.stringify({
      pageUrl,
    });

    const response = await this.fetch('POST', 'login/end', request);
    if (response && response.csrf) {
      this.antiForgeryToken = response.csrf;
    }

    return response;
  }

  /*
   * Invoked when the SPA wants to trigger a login redirect
   */
  async startLogin(): Promise<string> {

    const data = await this.fetch('POST', 'login/start', this.getRedirectOptions())
    return data.authorizationRequestUrl;
  }

  /*
   * Get user info from the API and return it to the UI for display
   */
  async getUserInfo(): Promise<any> {

    try {

      // Try the user info call
      return await this.fetch('GET', 'userInfo', null);

    } catch (remoteError) {

      // Report errors if this is not a 401
      if (!(remoteError instanceof RemoteError)) {
        throw remoteError;
      }

      if (!remoteError.isAccessTokenExpiredError()) {
        throw remoteError;
      }

      // Handle 401s by refreshing the access token in the HTTP only cookie
      await this.refresh();
      try {

        // Retry the user info call
        return await this.fetch('GET', 'userInfo', null);

      } catch (err) {

        // Report retry errors
        throw ErrorHandler.handleFetchError(err);
      }
    }
  }

  /*
   * Get ID token claims from the API and return it to the UI for display
   */
  async getClaims(): Promise<any> {
    return await this.fetch('GET', 'claims', null);
  }

  /*
   * Refresh the tokens stored in secure cookies when an API returns a 401 response
   */
  async refresh(): Promise<void> {
    await this.fetch('POST', 'refresh', null);
  }

  /*
   * Perform logout actions
   */
  async logout(): Promise<string> {
    const data = await this.fetch('POST', 'logout', null);
    this.antiForgeryToken = null;
    return data.url;
  }

  /*
   * Handle logout from another browser tab by clearing any secure values stored
   */
  async onLoggedOut(): Promise<void> {
    this.antiForgeryToken = null;
  }

  /*
   * Call the OAuth Agent in a parameterized manner
   */
  private async fetch(method: string, path: string, body: any): Promise<any> {
    const url = `${this.baseUrl}/${path}`;

    const options: object = {
      headers: new HttpHeaders({
        'accept': 'application/json',
        'content-type': 'application/json',
      }),
      
      // Send secure cookies
      withCredentials: true,
    };

    if (body) {
      options['body'] = body;
    }

    const observable = this.http.request(method, url, options)
      .pipe(catchError(err => {
        throw ErrorHandler.handleFetchError(err)
      }));

    return firstValueFrom(observable);
  }

  /*
   * If required, extra parameters can be provided during authentication redirects like this
   */
  private getRedirectOptions(): any {

    /*return {
        extraParams: [
            {
                key: 'ui_locales',
                value: 'sv',
            },
        ]
    };*/

    return null;
  }

  tryAddAntiForgeryTokenHeader(newHeaders: HttpHeaders) {
    // Add anti forgery token if available
    if (this.antiForgeryToken) {
      newHeaders.append('x-featbit-csrf', this.antiForgeryToken);
    }
  }
}
