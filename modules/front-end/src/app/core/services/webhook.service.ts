import { Injectable } from '@angular/core';
import { environment } from "src/environments/environment";
import { HttpClient } from "@angular/common/http";
import { Webhook } from "@features/safe/integrations/webhooks/webhooks";

@Injectable({
  providedIn: 'root'
})
export class WebhookService {
  baseUrl: string = `${environment.url}/api/v1/webhooks`

  constructor(private http: HttpClient) {
  }

  create(payload: Partial<Webhook>) {
    return this.http.post<any>(this.baseUrl, payload);
  }

  isNameUsed(name: string) {
    return this.http.get<boolean>(`${this.baseUrl}/is-name-used?name=${name}`);
  }
}