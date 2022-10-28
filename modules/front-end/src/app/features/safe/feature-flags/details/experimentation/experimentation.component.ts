import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ExperimentService } from '@services/experiment.service';
import { CustomEventTrackOption, EventType, ExperimentStatus } from '../../types/experimentations';
import * as moment from 'moment';
import {FeatureFlagService} from "@services/feature-flag.service";
import {FeatureFlag, IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IVariation} from "@shared/rules";
import {
  ExperimentListFilter,
  IExpt,
  IExptIteration,
  IExptIterationResult
} from "@features/safe/experiments/overview/types";

@Component({
  selector: 'ff-experimentations',
  templateUrl: './experimentation.component.html',
  styleUrls: ['./experimentation.component.less']
})
export class ExperimentationComponent implements OnInit, OnDestroy {

  compareWith = (o1: IExptIteration, o2: IExptIteration) => o1 && o2 && o1.id === o2.id;

  variations: IVariation[] = [];
  featureFlag: FeatureFlag = {} as FeatureFlag;
  isInitLoading = true;
  experimentation: string;
  onGoingExperiments: IExpt[] = [];
  refreshIntervalId;
  refreshInterval: number = 1000 * 60; // 1 minute

  onGoingStatus = [
    ExperimentStatus.Recording
  ];

  customEventTrackConversion: CustomEventTrackOption = CustomEventTrackOption.Conversion;
  customEventTrackNumeric: CustomEventTrackOption = CustomEventTrackOption.Numeric;
  customEventType: EventType = EventType.Custom;
  pageViewEventType: EventType = EventType.PageView;
  clickEventType: EventType = EventType.Click;

  exptStatusNotStarted: ExperimentStatus = ExperimentStatus.NotStarted;
  exptStatusPaused: ExperimentStatus = ExperimentStatus.Paused;
  exptStatusRecording: ExperimentStatus = ExperimentStatus.Recording;

  exptRulesVisible = false;

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private message: NzMessageService,
    private experimentService: ExperimentService
  ) {
    const featureFlagKey: string = decodeURIComponent(this.route.snapshot.params['key']);

    this.featureFlagService.getByKey(featureFlagKey).subscribe((result: IFeatureFlag) => {
      this.featureFlag = new FeatureFlag(result);
      this.variations = [...this.featureFlag.variations];
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshIntervalId);
  }

  onSetExptRulesClick() {
    this.exptRulesVisible = true;
  }

  onSetExptRulesClosed() {
    this.exptRulesVisible = false;
  }

  ngOnInit(): void {
    this.loadExperiments();

    this.refreshIntervalId = setInterval(() => {
      const activeExperimentIteration = this.onGoingExperiments.flatMap(expt => {
        expt.isLoading = true;

        return expt.iterations.filter(it => it.endTime === null || !it.isFinish).map( i =>
          ({
            experimentId: expt.id,
            iterationId: i.id
          })
        )
      });

      if (activeExperimentIteration.length > 0) {
        this.experimentService.getIterationResults(activeExperimentIteration).subscribe(res => {
          if (res && res.length > 0) {
            this.onGoingExperiments.forEach(expt => {
              const iteration = res.find(r => r.id === expt.selectedIteration.id);
              if (iteration) {
                expt.selectedIteration = this.processIteration(iteration, expt.baselineVariationId);
                if (iteration.updatedAt) {
                  expt.selectedIteration.updatedAt = iteration.updatedAt;
                  expt.selectedIteration.updatedAtStr = moment(iteration.updatedAt).format('YYYY-MM-DD HH:mm');
                }

                if (expt.metricCustomEventTrackOption === this.customEventTrackNumeric) {
                  // [min, max, max - min]
                  expt.selectedIteration.numericConfidenceIntervalBoundary = [
                    Math.min(...expt.selectedIteration.results.map(r => r.confidenceInterval[0])),
                    Math.max(...expt.selectedIteration.results.map(r => r.confidenceInterval[1])),
                  ];

                  expt.selectedIteration.numericConfidenceIntervalBoundary.push(expt.selectedIteration.numericConfidenceIntervalBoundary[1] - expt.selectedIteration.numericConfidenceIntervalBoundary[0]);
                }

                // update experiment original iterations
                const selectedIterationIndex = expt.iterations.findIndex(iteration => iteration.id === expt.selectedIteration.id);
                expt.iterations[selectedIterationIndex] = expt.selectedIteration;

                this.setExptStatus(expt, iteration);
              }
            });
          }

          this.onGoingExperiments.forEach(expt => {
            expt.isLoading = false;
            this.initChartConfig(expt);
          });
        }, _ => {
          this.onGoingExperiments.forEach(expt => expt.isLoading = false);
        });
      }
    }, this.refreshInterval);
  }

  experimentList: IExpt[] = [];
  private loadExperiments() {
    // temporary use 1000 as page size to assure to have all experiments in the first page
    // we should find a way to manage pagination
    const filter = new ExperimentListFilter(null, this.featureFlag.id, 1, 1000);
    this.experimentService.getList(filter).subscribe(experiments => {
      if (experiments) {
        this.experimentList = experiments.items.map(expt => {
          if (expt.iterations.length > 0) {
            expt.iterations = expt.iterations.map(iteration => this.processIteration(iteration, expt.baselineVariationId)).reverse();
            expt.selectedIteration = expt.iterations[0];

            if (expt.metricCustomEventTrackOption === this.customEventTrackNumeric) {
              // [min, max, max - min]
              expt.selectedIteration.numericConfidenceIntervalBoundary = [
                Math.min(...expt.selectedIteration.results.map(r => r.confidenceInterval[0])),
                Math.max(...expt.selectedIteration.results.map(r => r.confidenceInterval[1])),
              ];

              expt.selectedIteration.numericConfidenceIntervalBoundary.push(expt.selectedIteration.numericConfidenceIntervalBoundary[1] - expt.selectedIteration.numericConfidenceIntervalBoundary[0]);
            }
          }

          expt.isLoading = false;
          return expt;
        });

        this.onGoingExperiments = [...this.experimentList.filter(expt => this.onGoingStatus.includes(expt.status))];
        this.experimentList.forEach(experiment => this.initChartConfig(experiment));
      }
      this.isInitLoading = false;
    }, _ => {
      this.message.error($localize `:@@common.loading-failed-try-again:Loading failed, please try again`);
      this.isInitLoading = false;
    });
  }

  onStartIterationClick(expt: IExpt) {
    expt.isLoading  = true;
    this.experimentService.startIteration(expt.id).subscribe(res => {
      if (res) {
        expt.iterations = [this.processIteration(res, expt.baselineVariationId), ...expt.iterations];
        expt.selectedIteration = expt.iterations[0];
        expt.status = ExperimentStatus.Recording;

        this.loadIterationResults(expt);

        this.onGoingExperiments = [...this.onGoingExperiments, expt];
      }
      expt.isLoading  = false;
    }, _ => {
      this.message.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
      expt.isLoading  = false;
    });
  }

  onStopIterationClick(expt: IExpt) {
    expt.isLoading  = true;
    this.experimentService.stopIteration(expt.id, expt.selectedIteration.id).subscribe(res => {
      if (res) {
        expt.selectedIteration.endTime = res.endTime;
        expt.selectedIteration.dateTimeInterval = `${moment(expt.selectedIteration.startTime).format('YYYY-MM-DD HH:mm')} - ${moment(expt.selectedIteration.endTime).format('YYYY-MM-DD HH:mm')}`
        expt.status = ExperimentStatus.Paused;
      }

      expt.isLoading  = false;
    }, _ => {
      this.message.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
      expt.isLoading  = false;
    });
  }

  private setExptStatus(expt: IExpt, iteration: IExptIteration) {
    expt.status = iteration.isFinish ? ExperimentStatus.Paused : ExperimentStatus.Recording;

    return;
  }

  loadIterationResults(expt: IExpt) {
    expt.isLoading  = true;
    const param = {
      exptId: expt.id,
      iterationId: expt.selectedIteration.id,
      flagExptId: `${expt.envId}-${expt.featureFlagKey}`,
      baselineVariationId: expt.baselineVariationId,
      variationIds: this.featureFlag.variations.map(v => v.id),
      eventName: expt.metricEventName,
      eventType: expt.metricEventType,
      customEventTrackOption: expt.metricCustomEventTrackOption,
      customEventSuccessCriteria: expt.metricCustomEventSuccessCriteria,
      customEventUnit: expt.metricCustomEventUnit,
      startTime: expt.selectedIteration.startTime,
      endTime: expt.selectedIteration.endTime,
      isFinish: expt.selectedIteration.isFinish
    };

    this.experimentService.getIterationResults([param]).subscribe(res => {
      if (res) {
        expt.selectedIteration = this.processIteration({...expt.selectedIteration , ...res[0]}, expt.baselineVariationId);
        if (res[0].updatedAt) {
          expt.selectedIteration.updatedAt = res[0].updatedAt;
          expt.selectedIteration.updatedAtStr = moment(res[0].updatedAt).format('YYYY-MM-DD HH:mm');
        }

        if (expt.metricCustomEventTrackOption === this.customEventTrackNumeric) {
          // [min, max, max - min]
          expt.selectedIteration.numericConfidenceIntervalBoundary = [
            Math.min(...expt.selectedIteration.results.map(r => r.confidenceInterval[0])),
            Math.max(...expt.selectedIteration.results.map(r => r.confidenceInterval[1])),
          ];

          expt.selectedIteration.numericConfidenceIntervalBoundary.push(expt.selectedIteration.numericConfidenceIntervalBoundary[1] - expt.selectedIteration.numericConfidenceIntervalBoundary[0]);
        }

        this.setExptStatus(expt, res[0]);
      }

      expt.isLoading  = false;
    }, _ => {
      this.message.error($localize `:@@common.loading-failed-try-again:Loading failed, please try again`);
      expt.isLoading  = false;
    });
  }

  onReloadIterationResultsClick(expt: IExpt) {
    this.loadIterationResults(expt);
  }

  onDeleteExptClick(expt: IExpt) {
    expt.isLoading  = true;
    this.experimentService.archiveExperiment(expt.id).subscribe(_ => {
      this.experimentList = this.experimentList.filter(ex => ex.id !== expt.id);
      expt.isLoading  = false;
    }, _ => {
      this.message.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
      expt.isLoading  = false;
    });
  }

  onDeleteExptDataClick(expt: IExpt) {
    expt.isLoading  = true;
    this.experimentService.archiveExperimentData(expt.id).subscribe(_ => {
      expt.selectedIteration = null;
      expt.iterations = [];
      expt.status = ExperimentStatus.NotStarted;
      expt.isLoading  = false;
    }, _ => {
      this.message.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
      expt.isLoading  = false;
    });
  }

  private processIteration(iteration: IExptIteration, baselineVariationId: string): IExptIteration {
    const iterationResults = this.variations.map((option) => {
        const found = iteration.results.find(r => r.variation === option.id);
        return !found ? this.createEmptyIterationResult(option, baselineVariationId) : { ...found,
          variationValue: option.value,
          confidenceInterval: !found.confidenceInterval ? [-1, -1] : found.confidenceInterval.map(x => Math.max(0, x)),
          isEmpty: false,
        }
      });

    if (iterationResults.length === 0) {
      console.log('------------- Hello, Did you find what you want?--------------------')
    }

    const invalidVariation = !!iterationResults.find(e => e.isInvalid && !e.isBaseline);
    const winnerVariation = !!iterationResults.find(e => e.isWinner);

    return {
      ...iteration,
      invalidVariation,
      winnerVariation,
      results: iterationResults,
      dateTimeInterval: `${moment(iteration.startTime).format('YYYY-MM-DD HH:mm')} - ${iteration.endTime? moment(iteration.endTime).format('YYYY-MM-DD HH:mm') : moment(new Date()).format('YYYY-MM-DD HH:mm') + ' (现在)'}`
    };
  }

  private createEmptyIterationResult(option: IVariation, baselineVariationId: string): IExptIterationResult {
    return {
      isEmpty: true,
      variation: option.id,
      variationValue: option.value,
      confidenceInterval: [-1, -1],
      isBaseline: baselineVariationId === option.id
    } as IExptIterationResult;
  }

  private initChartConfig(experiment: IExpt) {
    const iterations = experiment.iterations;
    if (!iterations || !iterations.length) {
      return;
    }

    const xAxisName = $localize `:@@common.time:time`;
    const trackOption = iterations[0].customEventTrackOption;
    const valueUnit = trackOption === CustomEventTrackOption.Conversion
      ? '%' : (iterations[0].customEventUnit ? iterations[0].customEventUnit : '');
    const yAxisName = trackOption === CustomEventTrackOption.Conversion
      ? `${$localize `:@@common.conversion-rate:Conversion rate`}（${valueUnit}）`
      : iterations[0].customEventUnit ? `${$localize `:@@common.average:Average`}（${valueUnit}）` : $localize `:@@common.average:Average`;

    let source = [];
    let yAxisFormatter;
    iterations.forEach(iteration => {
      const xAxisValue = iteration.endTime ? iteration.endTime : iteration.updatedAt;
      iteration.results.forEach(result => {
        if (!result.variation ||
          !this.variations.find(option => option.id == result.variation)
        ) {
          return;
        }

        // see function **processIteration**
        let yAxisValue;
        if (trackOption === CustomEventTrackOption.Conversion) {
          const conversionRate = Number(result.conversionRate);
          yAxisValue = conversionRate ? conversionRate * 100 : 0;
          yAxisFormatter = val => `${val} %`;
        } else {
          const average = Number(result.average);
          yAxisValue = average ? average : 0;
        }

        source.push({variation: result.variationValue, time: xAxisValue, value: yAxisValue});
      });
    });

    experiment.chartConfig = {
      xAxis: {
        name: xAxisName,
        position: 'end',
        field: 'time',
        scale: {type: "timeCat", nice: true, range: [0.05, 0.95], mask: 'YYYY-MM-DD HH:mm'}
      },
      yAxis: {
        name: yAxisName,
        position: 'end',
        field: 'value',
        formatter: yAxisFormatter,
        scale: {nice: true}
      },
      source: source,
      dataGroupBy: 'variation',
      padding: [50, 50, 50, 70],
      toolTip: { tplFormatter: tpl => tpl.replace("{value}", `{value} ${valueUnit}`) },
    };
   }
}
