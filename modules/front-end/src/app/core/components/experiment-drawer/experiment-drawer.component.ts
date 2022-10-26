import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IProjectEnv } from '@shared/types';
import {IExperiment, IPagedMetric} from '@features/safe/feature-flags/types/experimentations';
import { ExperimentService } from '@services/experiment.service';
import { MetricService } from '@services/metric.service';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import {FeatureFlagService} from "@services/feature-flag.service";
import {IFeatureFlagListFilter, IFeatureFlagListModel} from "@features/safe/feature-flags/types/switch-index";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IVariation} from "@shared/rules";


@Component({
  selector: 'app-experiment-drawer',
  templateUrl: './experiment-drawer.component.html',
  styleUrls: ['./experiment-drawer.component.less']
})
export class ExperimentDrawerComponent implements OnInit {

  private _experiment: IExperiment;

  experimentForm: FormGroup;
  isLoading: boolean = false;

  public compareWith: (obj1: any, obj2: any) => boolean = (obj1: any, obj2: any) => {
    if (obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input()
  set experiment(experiment: IExperiment) {
    this.resetForm();

    this._experiment = experiment;
  }

  get experiment() {
    return this._experiment;
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private metricService: MetricService,
    private featureFlagService: FeatureFlagService,
    private experimentService: ExperimentService,
    private message: NzMessageService
  ) {
    const currentProjectEnv: IProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));

    this.featureFlagSearchChange$.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.featureFlagService.getList(new IFeatureFlagListFilter(searchText)).subscribe((result) => {
        this.featureFlagList = result;
        this.isFeatureFlagsLoading = false;
      }, error => {
        this.isFeatureFlagsLoading = false;
      });
    });

    this.metricSearchChange$.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.metricService.getMetrics({
        envId: currentProjectEnv.envId,
        pageIndex: 0,
        pageSize: 50,
        name: searchText
      }).subscribe((result) => {
        this.metricList = result;
        this.isMetricsLoading = false;
      }, error => {
        this.isMetricsLoading = false;
      });
    });
  }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.experimentForm = this.fb.group({
      featureFlag: [null, [Validators.required]],
      metricId: [null, [Validators.required]],
      baselineVariationId: [null, [Validators.required]],
    });
  }

  resetForm() {
    this.experimentForm && this.experimentForm.reset();
  }

  featureFlagSearchChange$ = new BehaviorSubject('');
  isFeatureFlagsLoading = false;
  featureFlagList: IFeatureFlagListModel;
  onSearchFeatureFlag(value: string) {
    if (value.length > 0) {
      this.isFeatureFlagsLoading = true;
      this.featureFlagSearchChange$.next(value);
    }
  }

  currentVariations: IVariation[] = [];
  onFeatureFlagChange(data: IFeatureFlag) {
    this.experimentForm.patchValue({
      baselineVariationId: null,
    });
    this.currentVariations = [...data.variations];
  }

  metricSearchChange$ = new BehaviorSubject('');
  isMetricsLoading = false;
  metricList: IPagedMetric;
  onSearchMetrics(value: string) {
    if (value.length > 0) {
      this.isMetricsLoading = true;
      this.metricSearchChange$.next(value);
    }
  }

  onClose() {
    this.close.emit({ isEditing: false, data: this._experiment });
  }

  doSubmit() {
    if (this.experimentForm.invalid) {
      for (const i in this.experimentForm.controls) {
        this.experimentForm.controls[i].markAsDirty();
        this.experimentForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;

    const { featureFlag, metricId, baselineVariationId } = this.experimentForm.value;

    const metric = this.metricList.items.find(m => m.id === metricId);
    this.experimentService.createExperiment({
      envId: this.experiment.envId,
      featureFlagId: featureFlag.id,
      metricId: metric.id,
      baselineVariationId,
    })
      .pipe()
      .subscribe(
        res => {
          this.isLoading = false;
          this.close.emit({ isEditing: false, data: {
              ...res,
              featureFlagKey: featureFlag.key,
              featureFlagName: featureFlag.name,
              metricName: metric.name,
              metricEventName: metric.eventName,
              metricEventType: metric.eventType,
              metricCustomEventTrackOption: metric.customEventTrackOption,
              baselineVariation: featureFlag.variations.find(v => v.id === baselineVariationId)
            }
          });
        },
        err => {
          this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
          this.isLoading = false;
        }
      );
  }
}
