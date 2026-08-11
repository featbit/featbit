import { IRule, IVariation } from "@shared/rules";
import { IFallthrough, IFeatureFlag } from "@features/safe/feature-flags/types/details";

export type CompareFlagOverviews = {
  items: CompareFlagOverview[];
  totalCount: number;
}

export type CompareFlagOverview = {
  id: string;
  name: string;
  key: string;
  tags: string[];
  description: string;
  diffs: FlagDiffOverview[];
}

export type FlagDiffOverview = {
  targetEnvId: string;
  onOffState: boolean;
  individualTargeting: boolean;
  targetingRule: boolean;
  defaultRule: boolean;
  offVariation: boolean;
}

export type CompareFlagDetail = {
  source: IFeatureFlag,
  target: IFeatureFlag,
  diff: FlagDiff,
  relatedSegments: { key: string, value: string }[]
  isRulesCopyable: boolean
}

export type FlagDiff = {
  onOffState: OnOffStateDiff;
  individualTargeting: IndividualTargetingDiff[];
  targetingRule: TargetingRuleDiff[];
  defaultRule: DefaultRuleDiff;
  offVariation: OffVariationDiff;
};

export type IndividualTargetingDiff = {
  source: VariationUsers;
  target: VariationUsers;
  isDifferent: boolean;
}

export type TargetingRuleDiff = {
  source: IRule | null;
  target: IRule | null;
  isDifferent: boolean;
}

export type DefaultRuleDiff = {
  source: IFallthrough | null;
  target: IFallthrough | null;
  isDifferent: boolean;
}

export type OnOffStateDiff = {
  source: boolean;
  target: boolean;
  isDifferent: boolean;
}

export type OffVariationDiff = {
  source: IVariation | null;
  target: IVariation | null;
  isDifferent: boolean;
}

export type VariationUsers = {
  variation: IVariation;
  users: string[];
};

export type FlagSettingCopyOptions = {
  onOffState: boolean,
  individualTargeting: {
    copy: boolean,
    mode: 'append' | 'overwrite'
  },
  targetingRule: {
    copy: boolean,
    mode: 'append' | 'overwrite'
  },
  defaultRule: boolean,
  offVariation: boolean
}
