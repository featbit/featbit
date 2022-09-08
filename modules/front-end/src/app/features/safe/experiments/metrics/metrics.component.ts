import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IAccount, IAccountUser, IProjectEnv } from '@shared/types';
import { MetricService } from '@services/metric.service';
import { TeamService } from '@services/team.service';
import { CustomEventSuccessCriteria, CustomEventTrackOption, EventType, IMetric } from '../../switch-manage/types/experimentations';
import { CURRENT_ACCOUNT, CURRENT_PROJECT } from "@utils/localstorage-keys";

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
  currentAccount: IAccount = null;

  currentMetric: IMetric;

  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;
  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;

  showType: '' | EventType = '';

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private teamService: TeamService,
    private metricService: MetricService
  ) {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.currentAccount = JSON.parse(localStorage.getItem(CURRENT_ACCOUNT()));

  //   const metricId = this.route.snapshot.queryParams['id'];
  //   if (metricId) {
  //     this.metricService.getMetric(this.currentProjectEnv.envId, metricId).subscribe(res => {
  //       if (res) {
  //         this.onCreateOrEditClick(res);
  //       }
  //     });
  //   }
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
      this.metricService.getMetrics({envId: this.currentProjectEnv.envId, searchText: e}).subscribe((result: any) => {
        if(result) {
          this.metricList = result;
          this.setMaintainerNames();
        } else {
          this.isLoading = false;
        }
      }, _ => {
        this.message.error("数据加载失败，请重试!");
        this.isLoading = false;
      })
    });
    this.search$.next('');
  }

  private setMaintainerNames() {
    const unMatchedUserIds: string[] = [];
    this.metricList = this.metricList.map(m => {
      const match = this.accountMemberList.find(r => r.userId === m.maintainerUserId);
      if (match) {
        return Object.assign({}, m, { maintainerName: match.userName});
      } else {
        unMatchedUserIds.push(m.maintainerUserId);
        return Object.assign({}, m);
      }
    });

    if (unMatchedUserIds.length > 0) {
      this.teamService.getMembers(this.currentAccount.id).subscribe((result) => {
        this.accountMemberList = result;
        this.metricList = this.metricList.map(m => {
          return Object.assign({}, m, { maintainerName: result.find(r => r.userId === m.maintainerUserId)?.userName});
        });
        this.isLoading = false;
      }, _ => {
        this.isLoading = false;
      });
    } else {
      this.isLoading = false;
    }
  }

  onCreateOrEditClick(metric?: IMetric) {
    this.currentMetric = metric || { envId: this.currentProjectEnv.envId, eventType: EventType.Custom, customEventTrackOption: CustomEventTrackOption.Conversion, customEventSuccessCriteria: CustomEventSuccessCriteria.Higher } as IMetric;
    this.detailViewVisible = true;
  }


  errorMsgTitle: string;
  errorMsgs: string[] = [];
  onDeleteClick(metric: IMetric, tpl: TemplateRef<void>) {
    this.isLoading = true;
    this.metricService.deleteMetric(this.currentProjectEnv.envId, metric.id).subscribe(res => {
      this.metricList = this.metricList.filter(m => metric.id !== m.id);
      this.isLoading = false;
      this.message.success("成功删除 Metric!");
    }, err => {
      this.isLoading = false;
      if (!!err?.error?.messages) {
        this.errorMsgTitle = '该 Metric 在以下开关的实验中被使用，请先删除实验';
        this.errorMsgs = err?.error?.messages || [];
        this.message.create('', tpl, { nzDuration: 5000 });
      } else {
        this.message.error('操作失败，请稍后重试！');
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
