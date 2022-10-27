import {
  CustomEventSuccessCriteria,
  CustomEventTrackOption,
  EventType, ExperimentStatus,
  IExperimentIterationResult
} from "@features/safe/feature-flags/types/experimentations";

export class ExperimentListFilter {
  featureFlagName?: string;
  featureFlagId?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    featureFlagName?: string,
    featureFlagId?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.featureFlagName = featureFlagName ?? '';
    this.featureFlagId = featureFlagId ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedExpt {
  totalCount: number;
  items: IExpt[];
}

export interface IExpt {
  id?: string;
  envId: string,
  featureFlagId: string,
  featureFlagName?: string;
  featureFlagKey?: string;
  metricId: string,
  metricName?: string,
  metricEventName?: string,
  metricEventType?: EventType,
  metricCustomEventTrackOption?: CustomEventTrackOption,
  metricCustomEventSuccessCriteria?: CustomEventSuccessCriteria,
  metricCustomEventUnit?: string,
  baselineVariationId: string,
  iterations?: IExptIteration[],
  status: ExperimentStatus,

  // UI only
  selectedIteration?: IExptIteration
  isLoading?: boolean,
  isChartExpanded?: boolean,
  chartConfig?: any // the config object for chart
}

export interface IExptIteration {
  id: string,
  startTime: Date,
  endTime: Date,
  updatedAt?: Date,
  updatedAtStr?: string,
  dateTimeInterval?: string,
  numericConfidenceIntervalBoundary?: number[], // [min, max, max - min]
  customEventTrackOption: CustomEventTrackOption,
  customEventUnit: string,
  isFinish: boolean,
  results: IExptIterationResult[],

  // UI only
  invalidVariation?: boolean,
  winnerVariation?: boolean,
}

export interface IExptIterationResult {
  changeToBaseline: number, // float
  conversion: number, // long
  conversionRate: number, // float
  isBaseline: boolean,
  isInvalid: boolean,
  isWinner: boolean,
  totalEvents: number,
  pValue: number, // float
  uniqueUsers: number, // long
  variation: string, // variationId
  variationValue: string,
  average: number,
  confidenceInterval: number[], // float[]
  isEmpty: boolean
}

export interface IExptStatusCount {
  status: ExperimentStatus,
  count: number
}
