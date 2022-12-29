import {IUserType} from "@shared/types";
import {ISegment} from "@features/safe/segments/types/segments-index";

export type ChangeValue = any;
export type ObjectType = {[key: string]: any};
export type PrimitiveType = string | boolean | number; // Date is converted to number by calling the method getTime()

export interface IDiffUser {
  keyId: string,
  name: string
}

export interface IDiffVarationUser {
  variationId: string,
  variation: string,
  users: IDiffUser[]
}

export interface IRefType {
  targetingUsers?: IUserType[],
  segments?: ISegment[]
}

export enum OperationEnum {
  ADD = "ADD",
  REMOVE = "REMOVE",
  UPDATE = "UPDATE",
  RULE = 'RULE',

  // Following ops are update indeed
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVED = 'UNARCHIVED'
}

export interface ICategory {
  label: string,
  changes: IChange[]
}

export interface IChange {
  label?: string,
  op: OperationEnum,
  isMultiValue: Boolean,
  path: string[],
  oldValue?: ChangeValue,
  value?: ChangeValue,
}
