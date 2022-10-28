import {Component, Inject, LOCALE_ID, OnDestroy, OnInit} from '@angular/core';
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
import {CURRENT_LANGUAGE, CURRENT_PROJECT} from "@utils/localstorage-keys";
import {ExperimentListFilter, IExpt, IPagedExpt} from "@features/safe/experiments/overview/types";
import {hasLocalePath} from "@utils/index";

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
  statusCount: {[key: string]: number} = {};

  filter: ExperimentListFilter = new ExperimentListFilter();

  constructor(
    @Inject(LOCALE_ID) public activeLocale: string,
    private router: Router,
    private message: NzMessageService,
    private experimentService: ExperimentService
  ) {
    this.activeLocale = localStorage.getItem(CURRENT_LANGUAGE());
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.loadStatusCounte();
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(e => {
      this.loadExperiments();
    });

    this.search$.next(null);
  }

  loadStatusCounte() {
    this.experimentService.getExperimentStatusCount().subscribe(res => {
      this.statusCount = res.reduce((acc, cur) => {
        acc[cur.status] = cur.count;
        return acc;
      }, {
        [ExperimentStatus.NotStarted]: 0,
        [ExperimentStatus.Paused]: 0,
        [ExperimentStatus.Recording]: 0,
      });
    })
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

  detailViewVisible: boolean = false;
  currentExperiment: IExperiment;
  onCreateClick() {
    this.currentExperiment = { envId: this.currentProjectEnv.envId } as IExperiment;
    this.detailViewVisible = true;
  }

  onDetailViewClosed(data: any) {
    this.detailViewVisible = false;

    if (data) {
      const predicate = (it: IExpt) => it.featureFlagId === data.data.featureFlagId && it.metricId === data.data.metricId;

      if (!this.pagedExpt.items.find(predicate)) {
        this.pagedExpt.items = [data.data, ...this.pagedExpt.items];
      } else {
        this.message.warning($localize `:@@expt.overview.expt-exists:Experiment with the same feature flag and metric exists`);
      }

      this.loadStatusCounte();
    }
  }

  goToFeatureFlag(featureFlagKey: string) {
    const path = hasLocalePath()? `/${this.activeLocale}/feature-flags/${featureFlagKey}/experimentations` : `/feature-flags/${featureFlagKey}/experimentations`;
    const url = this.router.serializeUrl(
      this.router.createUrlTree([path])
    );

    window.open(url, '_blank');
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }
}
