import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IProjectEnv } from '@shared/types';
import { IExperiment } from '@features/safe/switch-manage/types/experimentations';
import { IVariationOption } from '@features/safe/switch-manage/types/switch-new';
import { ExperimentService } from '@services/experiment.service';
import { MetricService } from '@services/metric.service';
import { SwitchService } from '@services/switch.service';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";


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
    if(obj1 && obj2) {
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
    private switchService: SwitchService,
    private experimentService: ExperimentService,
    private message: NzMessageService
  ) {
    const currentProjectEnv: IProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));

    this.featureFlagSearchChange$.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.switchService.queryFeatureFlags(currentProjectEnv.envId, searchText).subscribe((result) => {
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
      this.metricService.getMetrics({envId: currentProjectEnv.envId, searchText}).subscribe((result) => {
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
      baselineVariation: [null, [Validators.required]],
    });
  }

  patchForm(experiment: Partial<IExperiment>) {
    this.experimentForm.patchValue({
      //featureFlag: experiment.featureFlagId,
      metricId: experiment.metricId,
      baselineVariation: experiment.baselineVariation,
    });
  }

  resetForm() {
    this.experimentForm && this.experimentForm.reset();
  }

  featureFlagSearchChange$ = new BehaviorSubject('');
  isFeatureFlagsLoading = false;
  featureFlagList: any[];
  onSearchFeatureFlag(value: string) {
    if (value.length > 0) {
      this.isFeatureFlagsLoading = true;
      this.featureFlagSearchChange$.next(value);
    }
  }

  currentVariations: IVariationOption[] = [];
  onFeatureFlagChange(data: any) {
    this.currentVariations = [...data.variationOptions];
  }

  metricSearchChange$ = new BehaviorSubject('');
  isMetricsLoading = false;
  metricList: any[];
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

    const { featureFlag, metricId, baselineVariation } = this.experimentForm.value;

    this.experimentService.createExperiment({
      envId: this.experiment.envId,
      featureFlagId: featureFlag.id,
      baselineVariation: `${baselineVariation}`,
      variations: this.currentVariations.map(v => `${v.localId}`),
      metricId
    })
      .pipe()
      .subscribe(
        res => {
          this.isLoading = false;
          res.metric = this.metricList.find(m => m.id === res.metricId);
          res.featureFlagName = featureFlag.ff.name;
          this.close.emit({isEditing: false, data: res});
        },
        err => {
          this.message.error('发生错误，请重试！');
          this.isLoading = false;
        }
      );
  }
}
