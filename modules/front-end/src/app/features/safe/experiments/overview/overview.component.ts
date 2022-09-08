import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IProjectEnv } from '@shared//types';
import { ExperimentService } from '@services/experiment.service';
import { CustomEventTrackOption, EventType, ExperimentStatus, IExperiment } from '../../switch-manage/types/experimentations';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";

@Component({
  selector: 'experiments-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.less']
})
export class OverviewComponent implements OnInit, OnDestroy {

  private search$ = new Subject<any>();
  isLoading: boolean = true;
  searchText: string = '';
  experimentList: any[] = [];

  currentProjectEnv: IProjectEnv = null;

  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;
  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;

  constructor(
    private router: Router,
    private message: NzMessageService,
    private experimentService: ExperimentService
  ) {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
  }

  ngOnInit(): void {
    this.init();
    this.search$.next('');
  }

  onSearch() {
    this.search$.next(this.searchText);
  }

  getExptCountByStatus(status: ExperimentStatus): number {
    return this.experimentList.filter(expt => expt.status === status).length;
  }

  private init() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(e => {
      this.isLoading = true;
      this.experimentService.getExperiments({envId: this.currentProjectEnv.envId, searchText: e}).subscribe((result: IExperiment[]) => {
        if(result) {
          this.experimentList = result.map(r =>  Object.assign({}, r, { statusName: this.getStatusName(r.status)}));
        }

        this.isLoading = false;
      }, _ => {
        this.message.error("数据加载失败，请重试!");
        this.isLoading = false;
      })
    });
  }

  private getStatusName (status: ExperimentStatus) {
    switch(status){
      case ExperimentStatus.NotStarted:
        return '未开始';
      case ExperimentStatus.NotRecording:
        return '暂停';
      case ExperimentStatus.Recording:
        return '进行中';
      default:
        return '未开始';
    }
  }

  detailViewVisible: boolean = false;
  currentExperiment: IExperiment;
  onCreateClick() {
    this.currentExperiment = { envId: this.currentProjectEnv.envId } as IExperiment;
    this.detailViewVisible = true;
  }

  onDetailViewClosed(data: any) {
    this.detailViewVisible = false;

    if (data.data && data.data.id) {
      if (!this.experimentList.find(expt => expt.id === data.data.id)) {
        const experiment = Object.assign({}, data.data, { statusName: this.getStatusName(data.data.status)})
        this.experimentList = [experiment, ...this.experimentList];
        this.message.success('创建成功！');
      } else {
        this.message.warning("相同的实验已经存在");
      }
    }
  }

  goToFeatureFlag(featureFlagId: string) {
    this.router.navigateByUrl(`/switch-manage/${featureFlagId}/experimentations`);
  }

  goToMetric(metricId: string) {
    this.router.navigateByUrl(`/experimentations/metrics?id=${metricId}`);
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }
}
