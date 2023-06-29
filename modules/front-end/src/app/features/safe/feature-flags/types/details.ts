import { IRule, IRuleVariation, IVariation } from "@shared/rules";
import { deepCopy, isNumeric, tryParseJSONObject } from "@utils/index";

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
  description: string;
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
  description: string
}

export interface IFeatureFlagTargeting {
  key: string,
  targetUsers: IVariationUser[],
  rules: IRule[],
  fallthrough: IFallthrough,
  exptIncludeAllTargets: boolean,
  comment?: string
}

export interface IFallthrough {
  includedInExpt: boolean,
  variations: IRuleVariation[],
  dispatchKey: string,

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
  name: string;
  description: string;
  isEnabled: boolean;
  disabledVariationId: string;
}

export function isVariationValueValid(variationType: string, variationValue: string): boolean {
  switch (variationType) {
    case VariationTypeEnum.string:
      return variationValue.trim().length > 0;
    case VariationTypeEnum.boolean:
      return variationValue === 'true' || variationValue === 'false';
    case VariationTypeEnum.number:
      return isNumeric(variationValue);
    case VariationTypeEnum.json:
      return tryParseJSONObject(variationValue);
    default:
      return false;
  }
}

