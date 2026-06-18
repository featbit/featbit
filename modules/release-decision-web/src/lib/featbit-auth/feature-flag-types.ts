// Types mirror FeatBit Angular front-end
// (modules/front-end/src/app/features/safe/feature-flags/types/details.ts,
//  modules/front-end/src/app/shared/rules.ts,
//  modules/front-end/src/app/features/safe/segments/types/segments-index.ts).
// Kept wire-compatible so payloads round-trip unchanged.

export enum VariationType {
  String = "string",
  Json = "json",
  Number = "number",
  Boolean = "boolean",
}

export interface IVariation {
  id: string;
  name: string;
  value: string;
}

export interface ICondition {
  id: string;
  property: string;
  op: string;
  value: string;

  // UI-only, may be echoed back by server
  multipleValue?: string[];
  type?: string;
  isSingleOperator?: boolean;
  isSegment?: boolean;
}

export interface IRuleVariation {
  id: string;
  rollout: [number, number]; // [start, end], values 0..1 (end-start = share)
  exptRollout: number;       // 0..1, fraction of this variation's users sampled into the experiment

  // UI-only (not persisted by server, derived)
  percentage?: number;
  exptPercentage?: number;
  isInvalid?: boolean;
  label?: string;
}

export interface IRule {
  id: string;
  name: string;
  conditions: ICondition[];
  dispatchKey: string;
  variations?: IRuleVariation[];
  includedInExpt?: boolean;
  isNotPercentageRollout?: boolean;
}

export interface IFallthrough {
  includedInExpt: boolean;
  variations: IRuleVariation[];
  dispatchKey: string;
  isNotPercentageRollout?: boolean;
}

export interface IVariationUser {
  variationId: string;
  keyIds: string[];
}

export interface IFeatureFlag {
  id: string;
  envId: string;
  revision: string;
  name: string;
  key: string;
  variationType: VariationType;
  variations: IVariation[];
  targetUsers: IVariationUser[];
  rules: IRule[];
  isEnabled: boolean;
  disabledVariationId: string;
  fallthrough: IFallthrough;
  exptIncludeAllTargets: boolean;
  tags: string[];
  isArchived: boolean;
  creatorId: string;
  updatorId: string;
  createdAt: string;
  updatedAt: string;
  description: string;
}

export interface FlagTargeting {
  targetUsers: IVariationUser[];
  rules: IRule[];
  fallthrough: IFallthrough;
  exptIncludeAllTargets: boolean;
}

export interface UpdateFlagTargetingPayload {
  targeting: FlagTargeting;
  revision: string;
  comment: string;
}

export interface IVariationOverview {
  disabledVariation: string;
  enabledVariations: string[];
}

export interface SimpleUser {
  id: string;
  name: string;
  email?: string;
}

export interface LastChange {
  operator: SimpleUser;
  happenedAt: string;
  comment: string;
}

export interface IFeatureFlagListItem {
  id: string;
  name: string;
  key: string;
  description: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  variationType: string;
  serves: IVariationOverview;
  creator: SimpleUser;
  lastChange?: LastChange;
}

export interface IFeatureFlagListModel {
  items: IFeatureFlagListItem[];
  totalCount: number;
}

export interface FeatureFlagListFilter {
  name?: string;
  tags?: string[];
  isArchived?: boolean;
  isEnabled?: boolean;
  // 1-based on our side; service subtracts 1 before calling FeatBit.
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string;
}

// ── End-user properties ─────────────────────────────────────────────────────

export interface IUserPropPreset {
  value: string;
  description?: string;
}

export interface IUserProp {
  id: string;
  name: string;
  presetValues?: IUserPropPreset[];
  usePresetValuesOnly?: boolean;
  isBuiltIn?: boolean;
  isDigestField?: boolean;
  remark?: string;
}

// FeatBit magic segment-membership properties. When a condition's `property`
// equals one of these, its `value` is a JSON-stringified array of segment IDs.
export const USER_IS_IN_SEGMENT = "User is in segment";
export const USER_IS_NOT_IN_SEGMENT = "User is not in segment";
export function isSegmentCondition(property: string) {
  return property === USER_IS_IN_SEGMENT || property === USER_IS_NOT_IN_SEGMENT;
}

// ── Segments ────────────────────────────────────────────────────────────────

export enum SegmentType {
  EnvironmentSpecific = "environment-specific",
  Shared = "shared",
}

export interface ISegment {
  id: string;
  name: string;
  key: string;
  type: SegmentType;
  scopes: string[];
  tags: string[];
  description: string;
  updatedAt: string;
  included: string[];
  excluded: string[];
  rules: IRule[];
  isArchived: boolean;
}

export interface ISegmentListModel {
  items: ISegment[];
  totalCount: number;
}

export interface SegmentListFilter {
  name?: string;
  userKeyId?: string;
  isArchived?: boolean;
  pageIndex?: number;
  pageSize?: number;
}
