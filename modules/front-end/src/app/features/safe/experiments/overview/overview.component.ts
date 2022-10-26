import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {Subject} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {IProjectEnv} from '@shared//types';
import {ExperimentService} from '@services/experiment.service';
import {
  CustomEventTrackOption,
  EventType,
  ExperimentStatus,
  IExperiment
} from '../../feature-flags/types/experimentations';
import {CURRENT_PROJECT} from "@utils/localstorage-keys";
import {ExperimentListFilter, IExpt, IPagedExpt} from "@features/safe/experiments/overview/types";

@Component({
  selector: 'experiments-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.less']
})
export class OverviewComponent implements OnInit, OnDestroy {

  private search$ = new Subject<any>();
  isLoading: boolean = true;

  pagedExpt: IPagedExpt = {
    totalCount: 0,
    items: []
  };

  currentProjectEnv: IProjectEnv = null;

  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;
  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;
  customEventTrackNumeric: CustomEventTrackOption = CustomEventTrackOption.Numeric;

  exptStatusNotStarted: ExperimentStatus = ExperimentStatus.NotStarted;
  exptStatusPaused: ExperimentStatus = ExperimentStatus.Paused;
  exptStatusRecording: ExperimentStatus = ExperimentStatus.Recording;

  filter: ExperimentListFilter = new ExperimentListFilter();
  constructor(
    private router: Router,
    private message: NzMessageService,
    private experimentService: ExperimentService
  ) {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(e => {
      this.loadExperiments();
    });

    this.search$.next(null);
  }

  loadExperiments() {
    this.isLoading = true;
    this.experimentService.getList(this.filter).subscribe((result) => {
      this.pagedExpt = result;
      this.isLoading = false;
    }, _ => {
      this.message.error($localize `:@@common.loading-failed-try-again:Loading failed, please try again`);
      this.isLoading = false;
    })
  }

  onSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  getExptCountByStatus(status: ExperimentStatus): number {
    return 10; //this.experimentList.filter(expt => expt.status === status).length;
  }


  detailViewVisible: boolean = false;
  currentExperiment: IExperiment;
  onCreateClick() {
    this.currentExperiment = { envId: this.currentProjectEnv.envId } as IExperiment;
    this.detailViewVisible = true;
  }

  onDetailViewClosed(data: any) {
    this.detailViewVisible = false;

    const predicate = (it: IExpt) => it.featureFlagId === data.data.featureFlagId && it.metricId === data.data.metricId;

    if (!this.pagedExpt.items.find(predicate)) {
      this.pagedExpt.items = [data.data, ...this.pagedExpt.items];
    } else {
      this.message.warning($localize `:@@expt.overview.expt-exists:Experiment with the same feature flag and metric exists`);
    }
  }

  goToFeatureFlag(featureFlagKey: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/feature-flags/${featureFlagKey}/experimentations`])
    );

    window.open(url, '_blank');
  }

  goToMetric(metricId: string) {
    this.router.navigateByUrl(`/experimentations/metrics?id=${metricId}`);
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }
}
