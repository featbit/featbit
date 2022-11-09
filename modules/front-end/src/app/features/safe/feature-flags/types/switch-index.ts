import { FeatureFlagParams } from "@features/safe/feature-flags/types/switch-new";

export interface IFeatureFlagListModel {
  items: IFeatureFlagListItem[];
  totalCount: number;
}

export interface IFeatureFlagListItem {
  id: string;
  name: string;
  key: string;
  tags: string[];
  isEnabled: boolean;
  updatedAt: Date;
  variationType: string;
  serves: IVariationOverview,
}

export interface IVariationOverview {
  disabledVariation: string,
  enabledVariations: string[],
}

export interface IFeatureFlagListCheckItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface ICopyToEnvResult {
  copiedCount: number;
  ignored: string[];
}

export class IFeatureFlagListFilter {
  name?: string;
  userKeyId?: string;
  isEnabled?: boolean;
  tags?: string[];
  isArchived?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    userKeyId?: string,
    isEnabled?: boolean,
    tags?: string[],
    archivedOnly?: boolean,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.userKeyId = userKeyId ?? '';
    this.isEnabled = isEnabled;
    this.tags = tags ?? [];
    this.isArchived = !!archivedOnly;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IFeatureFlagDropdown {
  key: string;
  value: string;
}

export interface IFeatureFlagDetail {
  featureFlag: FeatureFlagParams;
  tags: string[];
}
