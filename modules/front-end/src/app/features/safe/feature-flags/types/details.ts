import { IRule, IRuleVariation, IVariation } from "@shared/rules";
import {deepCopy} from "@utils/index";

export class FeatureFlag implements IFeatureFlag {
  originalData: IFeatureFlag;
  constructor(data: IFeatureFlag) {
    for (let p in data) {
      if (data[p] !== null && (Array.isArray(data[p]) || typeof data[p] === 'object')) {
        this[p] = deepCopy(data[p]);
      } else {
        this[p] = data[p];
      }
    }

    this.originalData = deepCopy(data);
  }

  addTag(tag: string) {
    this.tags = [...this.tags, tag];
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter(x => x !== tag);
  }

  createdAt: Date;
  creatorId: string;
  disabledVariationId: string;
  envId: string;
  exptIncludeAllTargets: boolean;
  tags: string[];
  fallthrough: IFallthrough;
  id: string;
  isArchived: boolean;
  isEnabled: boolean;
  key: string;
  name: string;
  rules: IRule[];
  targetUsers: IVariationUser[];
  updatedAt: Date;
  updatorId: string;
  variationType: VariationTypeEnum;
  variations: IVariation[];
}

export interface IFeatureFlag {
  id: string,
  envId: string,
  name: string,
  key: string,
  variationType: VariationTypeEnum,
  variations: IVariation[],
  targetUsers: IVariationUser[],
  rules: IRule[],
  isEnabled: boolean,
  disabledVariationId: string,
  fallthrough: IFallthrough,
  exptIncludeAllTargets: boolean,
  tags: string[],
  isArchived: boolean,
  creatorId: string,
  updatorId: string,
  createdAt: Date,
  updatedAt: Date,
}

export interface IFeatureFlagTargeting {
  id: string,
  targetUsers: IVariationUser[],
  rules: IRule[],
  fallthrough: IFallthrough,
  exptIncludeAllTargets: boolean
}

export interface IFallthrough {
  includedInExpt: boolean,
  variations: IRuleVariation[],

  // UI only
  isNotPercentageRollout: boolean
}

export interface IVariationUser {
  variationId: string,
  keyIds: string[], // EndUser keyId array
}

export enum VariationTypeEnum {
  string = 'string',
  json = 'json',
  number = 'number',
  boolean = 'boolean',
}

export interface ISettingPayload {
  id: string,
  name: string;
  isEnabled: boolean;
  variationType: VariationTypeEnum;
  disabledVariationId: string;
  variations: IVariation[];
}

export interface IVariationsPayload {
  id: string,
  variationType: VariationTypeEnum,
  variations: IVariation[]
}


