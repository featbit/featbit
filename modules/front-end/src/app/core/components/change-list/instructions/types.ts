import { Type } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { InstructionKindEnum, RuleInstructionKinkOpEnum } from "../constants";
import { IRule } from "@shared/rules";

export interface IInstructionComponentData {
  kind: InstructionKindEnum;
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
  conditions: IInstructionCondition[];
}

export interface IRuleCondition extends IRuleId {
  condition: IInstructionCondition;
}

export interface IRuleConditionValues extends IRuleId {
  conditionId: string;
  values: string[];
}

export interface IRolloutVariations {
  rolloutVariations: IRuleVariation[];
}

export interface IRuleRolloutVariations extends IRuleId, IRolloutVariations {
}

export interface IVariationValue {
  id: string;
  value: string;
  name: string;
}

export interface IInstructionCondition {
  id?: string;
  property: string;
  op: string;
  value: string;

  // UI only
  opLabel?: string;
  displayValue?: boolean;
  isMultiValue?: boolean;
}

export interface IRuleVariation {
  id: string;
  rollout: number[];
}

export interface IDefaultVariation {
  dispatchKey: string;
  variations: IRuleVariation[]
}

export interface IVariationTargetUsers {
  keyIds: string[];
  variationId: string;
}

export type IInstructionValue = string | string[] | IVariationValue | IDefaultVariation | IRule | IRule[] | IVariationTargetUsers | IRuleName | IRuleDispatchKey | IRuleConditionIds | IRuleConditions | IRuleCondition | IRuleConditionValues | IRuleRolloutVariations | IRolloutVariations;

export interface IInstruction {
  kind: string;
  value: IInstructionValue;
}

export interface IChangeListParam {
  instructions: IInstruction[];
  previous: string;
  current: string;
}

export interface IInstructionKindComponent {
  kind: InstructionKindEnum;
  component: Type<IInstructionComponent>;
  value?: IInstructionValue;
  previous?: IFeatureFlag | ISegment;
  current?: IFeatureFlag | ISegment;
}

export interface IRuleInstructionGroup  {
  label: string;
  op: RuleInstructionKinkOpEnum,
  instructions: IInstructionKindComponent[]
}

export interface ICategoryInstruction {
  label: string;
  category?: string;
  instructions?: IInstructionKindComponent[];
  groups?: IRuleInstructionGroup[];
}
