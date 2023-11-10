import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Webhook } from "@features/safe/integrations/webhooks/webhooks";

@Component({
  selector: 'webhook-drawer',
  templateUrl: './webhook-drawer.component.html',
  styleUrls: ['./webhook-drawer.component.less']
})
export class WebhookDrawerComponent {

  title: string = '';

  private _webhook: Webhook;
  @Input()
  set webhook(webhook: Webhook) {
    this.title = webhook
      ? $localize`:@@integrations.webhooks.webhook-drawer.edit-title:Edit Webhook`
      : $localize`:@@integrations.webhooks.webhook-drawer.add-title:Add Webhook`;

    this._webhook = webhook;
  }

  @Input()
  visible: boolean = false;
  @Output()
  close: EventEmitter<void> = new EventEmitter();


  onClose() {
    this.close.emit();
  }
}
