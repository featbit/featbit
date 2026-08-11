export interface IGroup {
  id: string;
  name: string;
  resourceName: string;
  description: string;
  updatedAt: Date;
}

export class GroupListFilter {
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

export interface IPagedGroup {
  totalCount: number;
  items: IGroup[];
}

export interface IGroupMember {
  id: string;
  name: string;
  email: string;
  isGroupMember: boolean;
}

export class GroupMemberFilter {
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

export interface IPagedGroupMember {
  totalCount: number;
  items: IGroupMember[];
}

export function groupRn(group: IGroup) {
  return `group/${group.name}`;
}

export interface IGroupPolicy {
  id: string;
  name: string;
  type: string;
  description: string;
  isGroupPolicy: boolean;
}

export class GroupPolicyFilter {
  name?: string;
  getAllPolicies?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    getAllPolicies?: boolean,
    pageIndex: number = 1,
    pageSize: number = 8) {
    this.name = name ?? '';
    this.getAllPolicies = getAllPolicies ?? false;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedGroupPolicy {
  totalCount: number;
  items: IGroupPolicy[];
}
