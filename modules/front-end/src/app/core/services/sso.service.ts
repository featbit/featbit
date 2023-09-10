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

  get authorizeUrl() {
    return `${this.baseUrl}/oidc-authorize-url`;
  }

  isEnabled(): Promise<boolean> {
    return firstValueFrom(this.http.get<boolean>(`${this.baseUrl}/check-enabled`));
  }
}
