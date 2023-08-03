import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ExperimentService } from '@services/experiment.service';
import { MetricService } from '@services/metric.service';
import {FeatureFlagService} from "@services/feature-flag.service";
import {IFeatureFlagListFilter, IFeatureFlagListModel} from "@features/safe/feature-flags/types/feature-flag";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IVariation} from "@shared/rules";
import {IExpt, IPagedMetric, MetricListFilter} from "@features/safe/experiments/types";


@Component({
  selector: 'app-experiment-drawer',
  templateUrl: './experiment-drawer.component.html',
  styleUrls: ['./experiment-drawer.component.less']
})
export class ExperimentDrawerComponent implements OnInit {

  private _experiment: IExpt;

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
  set experiment(experiment: IExpt) {
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
    this.featureFlagSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(query => {
      this.featureFlagService.getList(new IFeatureFlagListFilter(query)).subscribe((result) => {
        this.featureFlagList = result;
        this.isFeatureFlagsLoading = false;
      }, () => {
        this.isFeatureFlagsLoading = false;
      });
    });

    this.metricSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(query => {
      this.metricService.getMetrics(new MetricListFilter(query)).subscribe((result) => {
        this.pagedMetric = result;
        this.isMetricsLoading = false;
      }, () => {
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

    this.experimentForm.get('featureFlag').valueChanges.subscribe((event) => {
      this.onFeatureFlagChange(event);
    })
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
  pagedMetric: IPagedMetric;
  onSearchMetrics(value: string) {
    if (value.length > 0) {
      this.isMetricsLoading = true;
      this.metricSearchChange$.next(value);
    }
  }

  onClose() {
    this.close.emit(null);
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

    const metric = this.pagedMetric.items.find(m => m.id === metricId);
    this.experimentService.createExperiment({
      featureFlagId: featureFlag.id,
      metricId: metric.id,
      baselineVariationId: baselineVariationId,
    }).subscribe(
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
      () => {
          this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
          this.isLoading = false;
        }
      );
  }
}
