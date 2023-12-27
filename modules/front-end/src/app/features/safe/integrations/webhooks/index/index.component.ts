import { Component, OnInit } from '@angular/core';
import { LastDelivery, PagedWebhook, Webhook, WebhookFilter } from "@features/safe/integrations/webhooks/webhooks";
import { WebhookService } from "@services/webhook.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { debounceTime, finalize } from "rxjs/operators";
import { formatDate } from "@angular/common";
import { ProjectService } from "@services/project.service";
import { IEnvironment, IProject } from "@shared/types";
import { Subject } from "rxjs";

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

  isProjectsLoading: boolean = true;
  projects: IProject[] = [];
  projectEnvs: IEnvironment[] = [];

  onSelectProject(projectId: string) {
    this.filter.envId = '';
    this.projectEnvs = this.projects.find(x => x.id === projectId)?.environments;
    this.doSearch();
  }

  search$ = new Subject<void>();
  filter: WebhookFilter = new WebhookFilter();

  constructor(
    private webhookService: WebhookService,
    private projectService: ProjectService,
    private message: NzMessageService
  ) { }

  async ngOnInit() {
    await this.loadProjects();
    this.loadWebhooks();

    this.search$.pipe(debounceTime(250)).subscribe(() => this.loadWebhooks());
  }

  async loadProjects() {
    this.isProjectsLoading = true;
    this.projects = await this.projectService.getListAsync();
    this.isProjectsLoading = false;
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

  doSearch() {
    this.filter.pageIndex = 1;
    this.search$.next();
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
  testModalVisible: boolean = false;
  logsModalVisible: boolean = false;

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

  openTestModal(item: Webhook) {
    this.selectedWebhook = item;
    this.testModalVisible = true;
  }

  closeTestModal() {
    this.selectedWebhook = undefined;
    this.testModalVisible = false;
  }

  openLogsModal(item: Webhook) {
    this.selectedWebhook = item;
    this.logsModalVisible = true;
  }

  closeLogsModal() {
    this.selectedWebhook = undefined;
    this.logsModalVisible = false;
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
