import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { Observable, of } from "rxjs";
import {
  IPagedRelayProxy,
  IRelayProxy,
  RelayProxyAgent,
  RelayProxyFilter
} from "@features/safe/relay-proxies/types/relay-proxy";
import { catchError } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class RelayProxyService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/relay-proxies`;
  }

  getList(filter: RelayProxyFilter = new RelayProxyFilter()): Observable<IPagedRelayProxy> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedRelayProxy>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  getAgentStatus(host: string): Observable<any> {
    const queryParam = {
      host
    };

    const url = `${this.baseUrl}/agent-status`;

    return this.http.get<any>(
      url,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(payload: RelayProxyAgent): Observable<IRelayProxy> {
    return this.http.post<IRelayProxy>(this.baseUrl, payload);
  }
}
