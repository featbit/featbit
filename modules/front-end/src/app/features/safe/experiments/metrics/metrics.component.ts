import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IProjectEnv } from '@shared/types';
import { MetricService } from '@services/metric.service';
import {
  IPagedMetric,
  MetricListFilter,
  CustomEventSuccessCriteria,
  CustomEventTrackOption,
  EventType,
  IMetric
} from "@features/safe/experiments/types";
import { getCurrentProjectEnv } from "@utils/project-env";

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
  currentProjectEnv: IProjectEnv = null;

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
    this.currentProjectEnv = getCurrentProjectEnv();
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

  archiveMetric(metric: IMetric) {
    this.isLoading = true;
    this.metricService.archiveMetric(metric.id).subscribe({
      next: () => {
        this.pagedMetric.items = this.pagedMetric.items.filter(m => metric.id !== m.id);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);

        this.isLoading = false;
      },
      error: httpErrorResponse => {
        const error = httpErrorResponse.error.errors[0];
        let errorMsg = error === 'MetricIsBeingUsed'
          ? $localize `:@@expt.metric.cannot-remove-metric-because-it-is-being-used:Cannot remove this metric because it's being used by experiment`
          : error;

        this.message.error(errorMsg);

        this.isLoading = false;
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
