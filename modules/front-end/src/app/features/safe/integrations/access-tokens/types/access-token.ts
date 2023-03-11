import { IPolicy } from "@features/safe/iam/types/policy";

export interface IAccessToken {
  id: string;
  type: string;
  name: string;
  policies: IPolicy[],
}

export enum AccessTokenTypeEnum {
  Personal = 'Personal',
  Service = 'Service'
}

export interface IAccessTokenPolicy extends IPolicy {
  isSelected: boolean
}
