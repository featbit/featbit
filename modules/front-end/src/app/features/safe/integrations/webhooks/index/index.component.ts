import { Component, OnInit } from '@angular/core';
import { LastDelivery, PagedWebhook, Webhook, WebhookFilter } from "@features/safe/integrations/webhooks/webhooks";
import { WebhookService } from "@services/webhook.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize } from "rxjs/operators";
import { formatDate } from "@angular/common";

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
    const happenedAt = formatDate(delivery.happenedAt, 'medium', 'en-US');
    const response = delivery.response;

    return delivery.success
      ? $localize`:@@webhooks.last-delivery-successful:Last delivery happened at ${happenedAt} was successful (HTTP Response: ${response}).`
      : $localize`:@@webhooks.last-delivery-failed:Last delivery happened at ${happenedAt} was not successful (Invalid HTTP Response: ${response}).`;
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
