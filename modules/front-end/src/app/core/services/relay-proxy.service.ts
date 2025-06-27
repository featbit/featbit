import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { Observable, of } from "rxjs";
import {
  UpsertRelayProxyPayload,
  PagedRelayProxy,
  RelayProxy,
  RelayProxyFilter,
  SyncAgentResult
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

  getList(filter: RelayProxyFilter = new RelayProxyFilter()): Observable<PagedRelayProxy> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<PagedRelayProxy>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  checkAgentAvailability(agentHost: string): Observable<number> {
    const url = `${this.baseUrl}/agent-availability`;

    return this.http.get<number>(
      url,
      { params: { agentHost } }
    );
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(payload: UpsertRelayProxyPayload): Observable<RelayProxy> {
    return this.http.post<RelayProxy>(this.baseUrl, payload);
  }

  update(id: string, payload: UpsertRelayProxyPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${id}`;

    return this.http.put<boolean>(url, payload);
  }

  syncToAgent(id: string, agentId: string, host: string): Observable<SyncAgentResult> {
    const url = `${this.baseUrl}/${id}/agents/${agentId}/sync`;

    return this.http.put<SyncAgentResult>(url, {}, { params: { host } });
  }
}
