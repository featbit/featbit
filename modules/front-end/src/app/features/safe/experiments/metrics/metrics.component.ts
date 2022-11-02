import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IOrganization, IAccountUser, IProjectEnv } from '@shared/types';
import { MetricService } from '@services/metric.service';
import { CustomEventSuccessCriteria, CustomEventTrackOption, EventType, IMetric } from '../../feature-flags/types/experimentations';
import { CURRENT_ORGANIZATION, CURRENT_PROJECT } from "@utils/localstorage-keys";
import {IPagedMetric, MetricListFilter} from "@features/safe/experiments/types";

@Component({
  selector: 'experiments-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.less']
})
export class MetricsComponent implements OnInit, OnDestroy {

  private search$ = new Subject<any>();
  isLoading: boolean = true;
  detailViewVisible: boolean = false;

  pagedMetric: IPagedMetric = {
    totalCount: 0,
    items: []
  };

  accountMemberList: IAccountUser[] = [];

  currentProjectEnv: IProjectEnv = null;
  currentAccount: IOrganization = null;

  currentMetric: IMetric;

  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;
  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;
  customEventTrackNumeric: CustomEventTrackOption = CustomEventTrackOption.Numeric;

  filter: MetricListFilter = new MetricListFilter();

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private metricService: MetricService
  ) {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.currentAccount = JSON.parse(localStorage.getItem(CURRENT_ORGANIZATION()));
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.isLoading = true;
      this.metricService.getMetrics(this.filter).subscribe((result: any) => {
        this.pagedMetric = result;
        this.isLoading = false;
      }, _ => {
        this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`);
        this.isLoading = false;
      })
    });
    this.search$.next(null);
  }

  onSearch() {
    this.search$.next(null);
  }

  onCreateOrEditClick(metric?: IMetric) {
    this.currentMetric = metric || { envId: this.currentProjectEnv.envId, eventType: EventType.Custom, customEventTrackOption: CustomEventTrackOption.Conversion, customEventSuccessCriteria: CustomEventSuccessCriteria.Higher } as IMetric;
    this.detailViewVisible = true;
  }

  errorMsgTitle: string;
  errorMsgs: string[] = [];
  onDeleteClick(metric: IMetric, tpl: TemplateRef<void>) {
    this.isLoading = true;
    this.metricService.archiveMetric(metric.id).subscribe(res => {
      this.pagedMetric.items = this.pagedMetric.items.filter(m => metric.id !== m.id);
      this.isLoading = false;
      this.message.success($localize`:@@common.operation-success:Operation succeeded`);
    }, err => {
      this.isLoading = false;
      if (!!err?.error?.messages) {
        this.errorMsgTitle = $localize`:@@expt.overview.metric-used-by-following-expt-remove-first:The Metric is used by the following experiments, please remove those experiments first`;
        this.errorMsgs = err?.error?.messages || [];
        this.message.create('', tpl, { nzDuration: 5000 });
      } else {
        this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
      }
    });
  }

  onDetailViewClosed(data: any) {
    this.detailViewVisible = false;

    if (!data.isEditing && data.data && data.data.id) {
      this.pagedMetric.items = [data.data, ...this.pagedMetric.items];
    }

    if (data.isEditing && data.data) {
      this.pagedMetric.items = this.pagedMetric.items.map(m => {
        return m.id === data.data.id ? data.data : m;
      })
    }
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }
}
