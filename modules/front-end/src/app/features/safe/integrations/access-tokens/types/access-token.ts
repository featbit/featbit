import { IPolicy } from "@features/safe/iam/types/policy";

export enum AccessTokenTypeEnum {
  Personal = 'Personal',
  Service = 'Service'
}

export interface IAccessTokenPolicy extends IPolicy {
  isSelected: boolean
}
