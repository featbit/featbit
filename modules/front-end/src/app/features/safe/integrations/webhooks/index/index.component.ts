import { Component, OnInit } from '@angular/core';
import { LastDelivery, PagedWebhook, Webhook, WebhookFilter } from "@features/safe/integrations/webhooks/webhooks";
import { WebhookService } from "@services/webhook.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize } from "rxjs/operators";

@Component({
  selector: 'index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  isLoading: boolean = true;
  webhooks: PagedWebhook = {
    totalCount: 0,
    items: []
  };
  filter: WebhookFilter = new WebhookFilter();

  constructor(
    private webhookService: WebhookService,
    private message: NzMessageService
  ) { }

  ngOnInit() {
    this.loadWebhooks();
  }

  loadWebhooks() {
    this.isLoading = true;
    this.webhookService.getList(this.filter)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: webhooks => this.webhooks = webhooks,
        error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`),
      });
  }

  getDeliveryTooltip(delivery: LastDelivery) {
    return delivery.success
      ? $localize`:@@webhooks.last-delivery-successful:Last delivery was successful. HTTP Response: ${delivery.response}`
      : $localize`:@@webhooks.last-delivery-failed:Last delivery was not successful. Invalid HTTP Response: ${delivery.response}`;
  }

  selectedWebhook: Webhook;
  drawerVisible: boolean = false;

  openDrawer(webhook: Webhook) {
    this.selectedWebhook = webhook;
    this.drawerVisible = true;
  }

  closeDrawer(hasChange: boolean) {
    this.selectedWebhook = undefined;
    this.drawerVisible = false;
    if (hasChange) {
      this.loadWebhooks();
    }
  }

  remove(id: string) {
    this.webhookService.delete(id).subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.loadWebhooks();
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }
}
