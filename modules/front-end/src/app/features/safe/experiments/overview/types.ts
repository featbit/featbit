import {IGroup} from "@features/safe/iam/types/group";
import {CustomEventTrackOption, EventType} from "@features/safe/feature-flags/types/experimentations";

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
  baselineVariationId: string
}
