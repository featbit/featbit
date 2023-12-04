import { IPolicy } from "@features/safe/iam/types/policy";
import { IPolicyStatement } from "@shared/policy";
import { SimpleUser } from "@shared/users";

export interface IAccessToken {
  id?: string;
  type: AccessTokenTypeEnum;
  creator?: SimpleUser;
  status?: string;
  token?: string;
  name: string;
  policies?: IPolicy[],
  permissions?: IPolicyStatement[],
  lastUsedAt?: string
}

export enum AccessTokenTypeEnum {
  Personal = 'Personal',
  Service = 'Service'
}

export enum AccessTokenStatusEnum {
  Active = 'Active',
  Inactive = 'Inactive'
}

export interface IAccessTokenPolicy extends IPolicy {
  isSelected: boolean
}

export class AccessTokenFilter {
  name?: string;
  creatorId?: string;
  type?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    creator?: string,
    type?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedAccessToken {
  totalCount: number;
  items: IAccessToken[];
}
