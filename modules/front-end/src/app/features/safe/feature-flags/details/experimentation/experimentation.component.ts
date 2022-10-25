import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ExperimentService } from '@services/experiment.service';
import { SwitchV1Service } from '@services/switch-v1.service';
import { FeatureFlagParams, IVariationOption } from '../../types/switch-new';
import { CustomEventTrackOption, EventType, ExperimentStatus, IExperiment, IExperimentIteration, IExperimentIterationResult } from '../../types/experimentations';
import * as moment from 'moment';
import { isNumber } from '@utils/index';

@Component({
  selector: 'switch-experimentations',
  templateUrl: './experimentation.component.html',
  styleUrls: ['./experimentation.component.less']
})
export class ExperimentationComponent implements OnInit, OnDestroy {

  compareWith = (o1: IExperimentIteration, o2: IExperimentIteration) => o1 && o2 && o1.id === o2.id;

  featureFlagId: string;
  currentVariationOptions: IVariationOption[] = [];
  currentFeatureFlag: FeatureFlagParams = null;
  isInitLoading = true;
  experimentation: string;
  onGoingExperiments: IExperiment[] = [];
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

  exptRulesVisible = false;

  constructor(
    private route: ActivatedRoute,
    private switchServe: SwitchV1Service,
    private message: NzMessageService,
    private experimentService: ExperimentService
  ) {
    const ffId: string = decodeURIComponent(this.route.snapshot.params['id']);
    this.switchServe.getSwitchDetail(ffId).subscribe(res => {
      this.currentFeatureFlag = new FeatureFlagParams(res);
      this.currentVariationOptions = this.currentFeatureFlag.getVariationOptions();
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
    this.featureFlagId = this.route.snapshot.paramMap.get('id');
    if(this.switchServe.envId) {
      this.initData();

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
          this.experimentService.getIterationResults(this.switchServe.envId, activeExperimentIteration).subscribe(res => {
            if (res && res.length > 0) {
              this.onGoingExperiments.forEach(expt => {
                const iteration = res.find(r => r.id === expt.selectedIteration.id);
                if (iteration) {
                  expt.selectedIteration = this.processIteration(iteration, expt.baselineVariation);
                  if (iteration.updatedAt) {
                    expt.selectedIteration.updatedAt = iteration.updatedAt;
                    expt.selectedIteration.updatedAtStr = moment(iteration.updatedAt).format('YYYY-MM-DD HH:mm');
                  }

                  if (expt.metric.customEventTrackOption === this.customEventTrackNumeric) {
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
  }

  experimentList: IExperiment[] = [];
  private initData() {
    // this.experimentService.getList({envId: this.switchServe.envId, featureFlagId: this.featureFlagId}).subscribe(experiments => {
    //   if (experiments) {
    //     this.experimentList = experiments.map(experiment => {
    //       const expt = Object.assign({}, experiment);
    //
    //       if (expt.iterations.length > 0) {
    //         expt.iterations = expt.iterations.map(iteration => this.processIteration(iteration, expt.baselineVariation)).reverse();
    //         expt.selectedIteration = expt.iterations[0];
    //
    //         if (expt.selectedIteration.updatedAt) {
    //           expt.selectedIteration.updatedAtStr = moment(expt.selectedIteration.updatedAt).format('YYYY-MM-DD HH:mm');
    //         }
    //
    //         if (experiment.metric.customEventTrackOption === this.customEventTrackNumeric) {
    //           // [min, max, max - min]
    //           expt.selectedIteration.numericConfidenceIntervalBoundary = [
    //             Math.min(...expt.selectedIteration.results.map(r => r.confidenceInterval[0])),
    //             Math.max(...expt.selectedIteration.results.map(r => r.confidenceInterval[1])),
    //           ];
    //
    //           expt.selectedIteration.numericConfidenceIntervalBoundary.push(expt.selectedIteration.numericConfidenceIntervalBoundary[1] - expt.selectedIteration.numericConfidenceIntervalBoundary[0]);
    //         }
    //       }
    //
    //       expt.isLoading = false;
    //       return expt;
    //     });
    //
    //     this.onGoingExperiments = [...this.experimentList.filter(expt => this.onGoingStatus.includes(expt.status))];
    //     this.experimentList.forEach(experiment => this.initChartConfig(experiment));
    //   }
    //   this.isInitLoading = false;
    // }, _ => {
    //   this.message.error("数据加载失败，请重试!");
    //   this.isInitLoading = false;
    // });
  }

  onStartIterationClick(expt: IExperiment) {
    expt.isLoading  = true;
    this.experimentService.startIteration(this.switchServe.envId, expt.id).subscribe(res => {
      if (res) {
        expt.iterations = [this.processIteration(res, expt.baselineVariation), ...expt.iterations];
        expt.selectedIteration = expt.iterations[0];
        expt.status = ExperimentStatus.Recording;

        this.onGoingExperiments = [...this.onGoingExperiments, expt];
      }
      expt.isLoading  = false;
    }, _ => {
      this.message.error("操作失败，请重试!");
      expt.isLoading  = false;
    });
  }

  onStopIterationClick(expt: IExperiment) {
    expt.isLoading  = true;
    this.experimentService.stopIteration(this.switchServe.envId, expt.id, expt.selectedIteration.id).subscribe(res => {
      if (res) {
        expt.selectedIteration.endTime = res.endTime;
        expt.selectedIteration.dateTimeInterval = `${moment(expt.selectedIteration.startTime).format('YYYY-MM-DD HH:mm')} - ${moment(expt.selectedIteration.endTime).format('YYYY-MM-DD HH:mm')}`
        expt.status = ExperimentStatus.NotRecording;
      }

      expt.isLoading  = false;
    }, _ => {
      this.message.error("操作失败，请重试!");
      expt.isLoading  = false;
    });
  }

  private setExptStatus(expt: IExperiment, iteration: IExperimentIteration) {
    expt.status = iteration.isFinish ? ExperimentStatus.NotRecording : ExperimentStatus.Recording;

    return;
  }

  onReloadIterationResultsClick(expt: IExperiment) {
    expt.isLoading  = true;
    this.experimentService.getIterationResults(this.switchServe.envId, [{ experimentId: expt.id, iterationId: expt.selectedIteration.id}]).subscribe(res => {
      if (res) {
        expt.selectedIteration = this.processIteration(res[0], expt.baselineVariation);
        if (res[0].updatedAt) {
          expt.selectedIteration.updatedAt = res[0].updatedAt;
          expt.selectedIteration.updatedAtStr = moment(res[0].updatedAt).format('YYYY-MM-DD HH:mm');
        }

        if (expt.metric.customEventTrackOption === this.customEventTrackNumeric) {
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
      //this.message.error("数据加载失败，请重试!");
      expt.isLoading  = false;
    });
  }

  onDeleteExptClick(expt: IExperiment) {
    expt.isLoading  = true;
    this.experimentService.archiveExperiment(this.switchServe.envId, expt.id).subscribe(_ => {
      this.experimentList = this.experimentList.filter(ex => ex.id !== expt.id);
      expt.isLoading  = false;
    }, _ => {
      this.message.error("操作失败，请重试!");
      expt.isLoading  = false;
    });
  }

  onDeleteExptDataClick(expt: IExperiment) {
    expt.isLoading  = true;
    this.experimentService.archiveExperimentData(this.switchServe.envId, expt.id).subscribe(_ => {
      expt.selectedIteration = null;
      expt.iterations = [];
      expt.status = ExperimentStatus.NotStarted;
      expt.isLoading  = false;
    }, _ => {
      this.message.error("操作失败，请重试!");
      expt.isLoading  = false;
    });
  }

  private processIteration(iteration: IExperimentIteration, baselineVariation: string) {
    const iterationResults = this.currentVariationOptions.map((option) => {
        const found = iteration.results.find(r => r.variation == option.localId);
        return !found ? this.createEmptyIterationResult(option, baselineVariation) : Object.assign({}, found, {
          conversion: !isNumber(found.conversion) ? '--' : found.conversion,
          conversionRate: !isNumber(found.conversionRate) ? '--' : found.conversionRate,
          uniqueUsers: !isNumber(found.uniqueUsers) ? '--' : found.uniqueUsers,
          totalEvents: !isNumber(found.totalEvents) ? '--' : found.totalEvents,
          average: !isNumber(found.average) ? '--' : found.average,
          variationValue: option.variationValue,
          pValue: !isNumber(found.pValue) ? '--' : found.pValue,
          confidenceInterval: !found.confidenceInterval ? [-1, -1] : found.confidenceInterval.map(x => Math.max(0, x)),
          isEmpty: false,
        })
      });

    if (iterationResults.length === 0) {
      console.log('------------- Hello, Did you find what you want?--------------------')
    }

    const invalidVariation = iterationResults.find(e => e.isInvalid && !e.isBaseline);
    const winnerVariation = iterationResults.find(e => e.isWinner);

    return Object.assign({}, iteration, {
      invalidVariation,
      winnerVariation,
      results: iterationResults,
      dateTimeInterval: `${moment(iteration.startTime).format('YYYY-MM-DD HH:mm')} - ${iteration.endTime? moment(iteration.endTime).format('YYYY-MM-DD HH:mm') : moment(new Date()).format('YYYY-MM-DD HH:mm') + ' (现在)'}`
    });
  }

  private createEmptyIterationResult(option: IVariationOption, baselineVariation: string): Partial<IExperimentIterationResult> {
    return {
      isEmpty: true,
      variationValue: option.variationValue,
      confidenceInterval: [-1, -1],
      isBaseline: baselineVariation === `${option.localId}`
    };
  }

  private initChartConfig(experiment: IExperiment) {
    const iterations = experiment.iterations;
    if (!iterations || !iterations.length) {
      return;
    }

    const xAxisName = '时间';
    const trackOption = iterations[0].customEventTrackOption;
    const valueUnit = trackOption === CustomEventTrackOption.Conversion
      ? '%' : (iterations[0].customEventUnit ? iterations[0].customEventUnit : '');
    const yAxisName = trackOption === CustomEventTrackOption.Conversion
      ? `转换率（${valueUnit}）`
      : iterations[0].customEventUnit ? `平均值（${valueUnit}）` : '平均值';

    let source = [];
    let yAxisFormatter;
    iterations.forEach(iteration => {
      const xAxisValue = iteration.endTime ? iteration.endTime : iteration.updatedAt;
      iteration.results.forEach(result => {
        if (!result.variation ||
          !this.currentVariationOptions.find(option => option.localId == result.variation)
        ) {
          return;
        }

        // see function **processIteration**
        // conversionRate average 这两个值为 -1 时 会被修改为 '--' 代表 '没有值' 显示为 0
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

    experiment.chartConfig = ({
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
    });
  }
}
