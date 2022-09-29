export interface IMember {
  id: string;
  email: string;
  invitorId: string;
  initialPassword?: string;
  groups: IMemberGroup[];
  name: string;
  // frontend use only
  resourceName: string;
}

export interface IMemberGroup {
  id: string;
  name: string;
  description: string;
  memberId: string;
  isGroupMember: boolean;
}

export class MemberGroupFilter {
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

export interface IPagedMemberGroup {
  totalCount: number;
  items: IMemberGroup[];
}

export class MemberFilter {
  searchText?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    searchText?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.searchText = searchText ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedMember {
  totalCount: number;
  items: IMember[];
}

export function memberRn(member: IMember) {
  const identity = member.email;
  return `member/${identity}`;
}

export interface IMemberPolicy {
  id: string;
  name: string;
  type: string;
  description: string;
  isMemberPolicy: boolean;
}

export class MemberPolicyFilter {
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

export interface IPagedMemberPolicy {
  totalCount: number;
  items: IMemberPolicy[];
}

export interface IInheritedMemberPolicy {
  id: string;
  name: string;
  type: string;
  description: string;
  groupName: string;
}

export class InheritedMemberPolicyFilter {
  name?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    pageIndex: number = 1,
    pageSize: number = 8) {
    this.name = name ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IPagedInheritedMemberPolicy {
  totalCount: number;
  items: IInheritedMemberPolicy[];
}
