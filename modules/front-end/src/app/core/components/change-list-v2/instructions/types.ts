import { Type } from "@angular/core";
import { InstructionKindEnum } from "@core/components/change-list-v2/constants";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";

export interface IInstructionComponentData {
  value: IInstructionValue;
  previous: IFeatureFlag | ISegment;
  current: IFeatureFlag | ISegment;
}

export interface IInstructionComponent {
  data: IInstructionComponentData;
}

export interface IRuleId {
  ruleId: string;
}

export interface IRuleName extends IRuleId {
  name: string;
}

export interface IRuleDispatchKey extends IRuleId {
  dispatchKey: string;
}

export interface IRuleConditionIds extends IRuleId {
  conditionIds: string[];
}

export interface IRuleConditions extends IRuleId {
  conditions: ICondition[];
}

export interface IRuleConditionValues extends IRuleId {
  conditionId: string;
  values: string[];
}

export interface IRuleVariations extends IRuleId {
  rolloutVariations: IRuleVariation[];
}

export interface IVariationValue {
  id: string;
  value: string;
  name: string;
}

export interface ICondition {
  id: string;
  property: string;
  op: string;
  value: string;
}

export interface IRuleVariation {
  id: string;
  rollout: number[];
}

export interface IDefaultVariation {
  dispatchKey: string;
  variations: IRuleVariation[]
}

export interface IRule extends IDefaultVariation {
  id: string;
  name: string;
  conditions: ICondition[];
}

export interface IVariationTargetUsers {
  keyIds: string[];
  variationId: string;
}

export type IInstructionValue = string | string[] | IVariationValue | IDefaultVariation | IRule | IVariationTargetUsers | IRuleName | IRuleDispatchKey | IRuleConditionIds | IRuleConditions | IRuleConditionValues | IRuleVariations

export interface IInstruction {
  kind: string;
  value: IInstructionValue;
}

export interface IChangeListParam {
  instructions: IInstruction[];
  previous: IFeatureFlag | ISegment;
  current: IFeatureFlag | ISegment;
}

export interface IInstructionKindComponent {
  kind: InstructionKindEnum;
  component: Type<IInstructionComponent>;
  value?: IInstructionValue;
  previous?: IFeatureFlag | ISegment;
  current?: IFeatureFlag | ISegment;
}
export interface ICategoryInstruction {
  category: string;
  instructions: IInstructionKindComponent[];
}
