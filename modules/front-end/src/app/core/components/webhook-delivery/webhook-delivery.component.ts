import { Component, Input } from '@angular/core';
import { WebhookDelivery } from "@features/safe/integrations/webhooks/webhooks";

@Component({
  selector: 'webhook-delivery',
  templateUrl: './webhook-delivery.component.html',
  styleUrls: ['./webhook-delivery.component.less']
})
export class WebhookDeliveryComponent {
  _delivery: WebhookDelivery;
  @Input()
  set delivery(value: WebhookDelivery) {
    this._delivery = value;
    if (value) {
      this.parseDelivery(value);
    }
  }

  requestHeaders: string = '';
  requestPayload: string = '';
  responseHeaders: string = '';
  responseBody: string = '';
  completedIn: number;

  parseDelivery(delivery: WebhookDelivery) {
    let request = delivery.request;
    if (request) {
      this.requestHeaders = [
        `Request URL: ${request.url}`,
        'Request method: POST',
        'Accept: */*',
        'Content-Type: application/json',
        Object.keys(request.headers).map(x => `${x}: ${request.headers[x]}`).join('\n')
      ].join('\n');
      this.requestPayload = this.tryFormatStringAsJson(request.payload);
    }

    let response = delivery.response;
    if (response) {
      this.responseHeaders = Object.keys(response.headers).map(x => `${x}: ${response.headers[x]}`).join('\n');
      this.responseBody = this.tryFormatStringAsJson(response.body);
    }

    this.completedIn = (new Date(delivery.endedAt).getTime() - new Date(delivery.startedAt).getTime()) / 1000;
  }

  private tryFormatStringAsJson(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }
}
