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
  customEventTrackNumeric: CustomEventTrackOption = CustomEventTrackOption.Numeric;

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
          this.experimentList = [...result];
        }

        this.isLoading = false;
      }, _ => {
        this.message.error($localize `:@@common.loading-failed-try-again:Loading failed, please try again`);
        this.isLoading = false;
      })
    });
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
        const experiment = {...data.data};
        this.experimentList = [experiment, ...this.experimentList];
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      } else {
        this.message.warning($localize `:@@expt.overview.expt-exists:Experiment with the same feature flag and metric exists`);
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
