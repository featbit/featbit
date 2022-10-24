import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IOrganization, IAccountUser, IProjectEnv } from '@shared/types';
import { MetricService } from '@services/metric.service';
import { TeamService } from '@services/team.service';
import { CustomEventSuccessCriteria, CustomEventTrackOption, EventType, IMetric } from '../../feature-flags/types/experimentations';
import { CURRENT_ORGANIZATION, CURRENT_PROJECT } from "@utils/localstorage-keys";

@Component({
  selector: 'experiments-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.less']
})
export class MetricsComponent implements OnInit, OnDestroy {

  private search$ = new Subject<any>();
  isLoading: boolean = true;
  detailViewVisible: boolean = false;
  searchText: string = '';
  metricList: IMetric[] = [];
  accountMemberList: IAccountUser[] = [];

  currentProjectEnv: IProjectEnv = null;
  currentAccount: IOrganization = null;

  currentMetric: IMetric;

  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;
  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;
  customEventTrackNumeric: CustomEventTrackOption = CustomEventTrackOption.Numeric;

  showType: '' | EventType = '';

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private teamService: TeamService,
    private metricService: MetricService
  ) {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.currentAccount = JSON.parse(localStorage.getItem(CURRENT_ORGANIZATION()));
  }

  ngOnInit(): void {
    this.init();
  }

  onSearch() {
    this.search$.next(this.searchText);
  }

  private init() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(e => {
      this.isLoading = true;
      this.metricService.getMetrics({
        envId: this.currentProjectEnv.envId,
        pageIndex: 0,
        pageSize: 2000,
        name: e
      }).subscribe((result: any) => {
        if (result) {
          this.metricList = result.items;
        }
        this.isLoading = false;
      }, _ => {
        this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`);
        this.isLoading = false;
      })
    });
    this.search$.next('');
  }

  onCreateOrEditClick(metric?: IMetric) {
    this.currentMetric = metric || { envId: this.currentProjectEnv.envId, eventType: EventType.Custom, customEventTrackOption: CustomEventTrackOption.Conversion, customEventSuccessCriteria: CustomEventSuccessCriteria.Higher } as IMetric;
    this.detailViewVisible = true;
  }


  errorMsgTitle: string;
  errorMsgs: string[] = [];
  onDeleteClick(metric: IMetric, tpl: TemplateRef<void>) {
    this.isLoading = true;
    this.metricService.archiveMetric(this.currentProjectEnv.envId, metric.id).subscribe(res => {
      this.metricList = this.metricList.filter(m => metric.id !== m.id);
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
      this.metricList = [data.data, ...this.metricList];
    }

    if (data.isEditing && data.data) {
      this.metricList = this.metricList.map(m => {
        return m.id === data.data.id ? data.data : m;
      })
    }
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }
}
