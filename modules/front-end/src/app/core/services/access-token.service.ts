import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { getCurrentOrganization } from "@utils/project-env";
import { environment } from "src/environments/environment";
import { Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { IPolicy } from "@features/safe/iam/types/policy";
import { IAccessToken } from "@features/safe/integrations/access-tokens/types/access-token";

@Injectable({
  providedIn: 'root'
})
export class AccessTokenService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    const organizationId = getCurrentOrganization().id;
    return `${environment.url}/api/v1/organizations/${organizationId}/access-tokens`;
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(name: string, type: string, policyIds: string[] = []): Observable<IAccessToken> {
    return this.http.post<IAccessToken>(this.baseUrl, { name, type, policyIds });
  }
}
