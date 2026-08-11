import { Injectable } from '@angular/core';
import { environment } from "src/environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import {
  PagedWebhook,
  Webhook,
  PagedWebhookDelivery,
  WebhookDelivery,
  WebhookFilter,
  WebhookDeliveryFilter,
  WebhookRequest
} from "@features/safe/integrations/webhooks/webhooks";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class WebhookService {
  baseUrl: string = `${environment.url}/api/v1/webhooks`

  constructor(private http: HttpClient) {
  }

  getList(filter: WebhookFilter = new WebhookFilter()): Observable<PagedWebhook> {
    const queryParam = {
      name: filter.name ?? '',
      projectId: filter.projectId ?? '',
      envId: filter.envId ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<PagedWebhook>(
      this.baseUrl,
      { params: new HttpParams({ fromObject: queryParam }) }
    );
  }

  create(payload: Partial<Webhook>) {
    return this.http.post<any>(this.baseUrl, payload);
  }

  isNameUsed(name: string) {
    return this.http.get<boolean>(`${this.baseUrl}/is-name-used?name=${name}`);
  }

  update(id: string, payload: Partial<Webhook>) {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  send(request: WebhookRequest): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${this.baseUrl}/send`, request);
  }

  getDeliveries(id: string, filter: WebhookDeliveryFilter): Observable<PagedWebhookDelivery> {
    const queryParam = {
      event: filter.event ?? '',
      success: filter.success ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<PagedWebhookDelivery>(
      `${this.baseUrl}/${id}/deliveries`,
      { params: new HttpParams({ fromObject: queryParam }) }
    );
  }
}