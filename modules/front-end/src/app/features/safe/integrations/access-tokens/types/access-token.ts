import { IPolicy } from "@features/safe/iam/types/policy";

export enum AccessTokenTypeEnum {
  Personal = 'personal',
  Service = 'service'
}

export interface IAccessTokenPolicy extends IPolicy {
  isSelected: boolean
}
