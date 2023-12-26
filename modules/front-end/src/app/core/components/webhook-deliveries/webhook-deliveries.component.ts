import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  PagedWebhookDelivery,
  Webhook,
  WebhookDeliveryFilter,
  WebhookEvents
} from "@features/safe/integrations/webhooks/webhooks";
import { Subject } from "rxjs";
import { WebhookService } from "@services/webhook.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { debounceTime, finalize } from "rxjs/operators";

@Component({
  selector: 'webhook-deliveries',
  templateUrl: './webhook-deliveries.component.html',
  styleUrls: ['./webhook-deliveries.component.less']
})
export class WebhookDeliveriesComponent {
  @Input()
  visible: boolean;
  private _webhook: Webhook;
  @Input()
  set webhook(value: Webhook) {
    this._webhook = value;
    if (value) {
      this.loadDeliveries();
    }
  }
  @Output()
  close: EventEmitter<void> = new EventEmitter();

  isLoading: boolean = true;
  deliveries: PagedWebhookDelivery = {
    totalCount: 0,
    items: []
  };
  filter: WebhookDeliveryFilter = new WebhookDeliveryFilter();
  search$ = new Subject<void>();

  constructor(private webhookService: WebhookService, private message: NzMessageService) {
    this.search$.pipe(debounceTime(250)).subscribe(() => this.loadDeliveries());
  }

  events: string[] = WebhookEvents.map(e => e.value);
  statuses: string[] = ['All', 'Succeeded', 'Failed'];

  loadDeliveries() {
    this.isLoading = true;
    this.webhookService.getDeliveries(this._webhook.id, this.filter)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: deliveries => {
          this.deliveries = deliveries;
          this.expandedRowId = deliveries.items.length > 0 ? deliveries.items[0].id : '';
        },
        error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`),
      });
  }


  doSearch() {
    this.filter.pageIndex = 1;
    this.search$.next();
  }

  onStatusChange(index: number) {
    const status = this.statuses[index];
    this.filter.success = status === 'All' ? null : status === 'Succeeded';
    this.doSearch();
  }

  expandedRowId: string = '';
  expandRow(id: string): void {
    this.expandedRowId = this.expandedRowId === id ? '' : id;
  }
  isRowExpanded(id: string): boolean {
    return this.expandedRowId === id;
  }

  onClose() {
    // reset status
    this.filter = new WebhookDeliveryFilter();
    this.deliveries = {
      totalCount: 0,
      items: []
    };

    this.visible = false;
    this.close.emit();
  }
}
