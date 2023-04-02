import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";
import {
  AccessTokenFilter,
  IAccessToken,
  IPagedAccessToken
} from "@features/safe/integrations/access-tokens/types/access-token";
import { IPolicyStatement } from "@shared/policy";

@Injectable({
  providedIn: 'root'
})
export class AccessTokenService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/access-tokens`;
  }

  getList(filter: AccessTokenFilter = new AccessTokenFilter()): Observable<IPagedAccessToken> {
    const queryParam = {
      name: filter.name ?? '',
      type: filter.type ?? '',
      creatorId: filter.creatorId ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedAccessToken>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(name: string, type: string, permissions: IPolicyStatement[] = []): Observable<IAccessToken> {
    return this.http.post<IAccessToken>(this.baseUrl, { name, type, permissions });
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  toggleStatus(id: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/toggle`, {});
  }

  update(id: string, name: string): Observable<boolean> {
    const url = this.baseUrl;
    return this.http.put<boolean>(url + `/${id}`, { name });
  }
}
