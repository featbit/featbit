
export enum FeatureFlagType {
  Classic = 1,
  Pretargeted = 2 // 已经预分流，无需我们的开关做用户分流
}

export interface IFfParams {
    id: string;
    name: string;
    type: FeatureFlagType;
    key: string;
    environmentId: number;
    creatorUserId: string;
    status: 'Enabled' | 'Disabled';
    lastUpdatedTime: string;
    // multi states
    variationOptionWhenDisabled: IVariationOption;
    defaultRulePercentageRollouts: IRulePercentageRollout[];
    isDefaultRulePercentageRolloutsIncludedInExpt: boolean;
}

export interface IVariationOption {
  localId: number;
  displayOrder: number;
  variationValue: string;

  // ui only
  isInvalid?: boolean
}


export interface IRulePercentageRollout {
  rolloutPercentage: number[]; // only two elements, start and end
  valueOption: IVariationOption;
  exptRollout?: number; // 0.45 means 45% TODO this is not optional

  percentage?: number; // the percentage representation of rolloutPercentage // only for display usage
  exptPercentage?: number;  // the percentage representation of exptRollout // only for display usage
}
