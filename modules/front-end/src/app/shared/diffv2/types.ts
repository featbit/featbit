
export type ChangeValue = any;
export type ObjectType = {[key: string]: any};
export type PrimitiveType = string | boolean | number; // Date is converted to number by calling the method getTime()

export enum OperationEnum {
  ADD = "ADD",
  REMOVE = "REMOVE",
  UPDATE = "UPDATE"
}

export interface IChange {
  label?: string,
  op: OperationEnum,
  path: string[],
  oldValue?: ChangeValue,
  value?: ChangeValue,
}
