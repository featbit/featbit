import { IPolicyStatement } from "@shared/policy";

export interface IPolicy {
  id: string;
  type: string;
  name: string;
  description: string;
  statements: IPolicyStatement[],
  updatedAt: Date;

  // front end use only
  resourceName?: string;
}

export class PolicyFilter {
  name?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedPolicy {
  totalCount: number;
  items: IPolicy[];
}

export interface IPolicyGroup {
  id: string;
  name: string;
  description: string;
  isPolicyGroup: boolean;
}

export class PolicyGroupFilter {
  name?: string;
  getAllGroups: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    getAllGroups?: boolean,
    pageIndex: number = 1,
    pageSize: number = 8) {
    this.name = name ?? '';
    this.getAllGroups = getAllGroups ?? false;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedPolicyGroup {
  totalCount: number;
  items: IPolicyGroup[];
}

export interface IPolicyMember {
  id: string;
  email: string;
  phoneNumber: string;
  isPolicyMember: boolean;
}

export class PolicyMemberFilter {
  searchText?: string;
  getAllMembers?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    searchText?: string,
    getAllMembers?: boolean,
    pageIndex: number = 1,
    pageSize: number = 8) {
    this.searchText = searchText ?? '';
    this.getAllMembers = getAllMembers ?? false;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedPolicyMember {
  totalCount: number;
  items: IPolicyMember[];
}

export function policyRn(policy: IPolicy) {
  return `policy/${policy.name}`;
}

export enum PolicyTypeEnum {
  SysManaged = 'SysManaged',
  CustomerManaged = 'CustomerManaged'
}
