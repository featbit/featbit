import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestWebhook, WebhookDelivery, WebhookEvents } from "@features/safe/integrations/webhooks/webhooks";
import { NzMessageService } from "ng-zorro-antd/message";
import { WebhookService } from "@services/webhook.service";
import { finalize } from "rxjs/operators";
import { uuidv4 } from "@utils/index";
import { Subscription } from "rxjs";
import { getTestPayload } from "./test-webhook";

@Component({
  selector: 'test-webhook-modal',
  templateUrl: './test-webhook-modal.component.html',
  styleUrls: ['./test-webhook-modal.component.less']
})
export class TestWebhookModalComponent {
  @Input()
  visible: boolean;
  @Input()
  webhook: TestWebhook;
  @Output()
  close: EventEmitter<void> = new EventEmitter();

  events: string[] = WebhookEvents.map(x => x.value);
  event: string = this.events[1];

  constructor(
    private message: NzMessageService,
    private webhookService: WebhookService
  ) { }

  onClose() {
    // reset status
    this.delivery = null;
    this.isSending = false;
    this.event = this.events[1];
    this.sendSubscription?.unsubscribe();

    this.visible = false;
    this.close.emit();
  }

  isSending: boolean = false;
  delivery: WebhookDelivery = null;
  sendSubscription: Subscription;
  sendTest() {
    this.isSending = true;

    const payload = getTestPayload(this.event, this.webhook.payloadTemplate);
    const request = {
      id: this.webhook.id,
      deliveryId: uuidv4(),
      url: this.webhook.url,
      name: this.webhook.name,
      secret: this.webhook.secret,
      headers: this.webhook.headers,
      events: this.event,
      payload: payload
    };

    this.sendSubscription = this.webhookService.send(request)
      .pipe(finalize(() => this.isSending = false))
      .subscribe({
        next: (delivery) => {
          this.delivery = delivery;
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
      });
  }
}
