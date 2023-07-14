import {IVariation} from "@shared/rules";

export class MetricListFilter {
  metricName?: string;
  eventType?: EventType;
  pageIndex: number;
  pageSize: number;

  constructor(
    metricName?: string,
    eventType?: EventType,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.metricName = metricName ?? '';
    this.eventType = eventType;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedMetric {
  totalCount: number;
  items: IMetric[];
}

export interface IExptCreation {
  featureFlagId: string,
  metricId: string,
  baselineVariationId: string,
}

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
  baselineVariation: IVariation,
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
  variationId: string,
  variationValue: string,
  average: number,
  confidenceInterval: number[], // float[]
  isEmpty: boolean
}

export interface IExptStatusCount {
  status: ExperimentStatus,
  count: number
}

export enum EventType {
  Custom = 1,
  PageView = 2,
  Click = 3
}

export enum CustomEventTrackOption {
  Undefined = 0,
  Conversion = 1,
  Numeric = 2
}

export enum CustomEventSuccessCriteria {
  Undefined = 0,
  Lower = 2, // lower than baseline
  Higher = 1 // higher than baseline
}

export enum ExperimentStatus {
  NotStarted = 'NotStarted',
  Paused = 'Paused',
  Recording = 'Recording'
}

export enum UrlMatchType {
  Substring = 1
}

export interface ITargetUrl {
  matchType: UrlMatchType,
  url: string
}

export interface IMetric {
  id?: string,
  name: string,
  envId: string,
  description: string,
  maintainerUserId: string,
  eventName: string,
  eventType: EventType,
  customEventTrackOption?: CustomEventTrackOption,
  customEventUnit?: string,
  customEventSuccessCriteria?: CustomEventSuccessCriteria,
  elementTargets?: string,
  targetUrls?: ITargetUrl[]
}
