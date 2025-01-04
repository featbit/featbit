import { IUserType } from "@shared/types";

export class EnvUserFilter {
  searchText?: string;
  properties?: string[];
  excludedKeyIds?: string[];
  includeGlobalUser?: boolean;
  globalUserOnly?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    searchText?: string,
    properties?: string[],
    excludeKeyIds?: string[],
    includeGlobalUser?: boolean,
    globalUserOnly?: boolean,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.searchText = searchText ?? '';
    this.properties = properties ?? [];
    this.excludedKeyIds = excludeKeyIds ?? [];
    this.includeGlobalUser = includeGlobalUser ?? false;
    this.globalUserOnly = globalUserOnly ?? false;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface EnvUserPagedResult {
  totalCount: number;
  items: IUserType[];
}
