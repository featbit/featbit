import { IUserType } from "@shared/types";

export class EnvUserFilter {
  searchText?: string;
  properties?: string[];
  excludedKeyIds?: string[];
  pageIndex: number;
  pageSize: number;

  constructor(
    searchText?: string,
    properties?: string[],
    excludeKeyIds?: string[],
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.searchText = searchText ?? '';
    this.properties = properties ?? [];
    this.excludedKeyIds = excludeKeyIds ?? [];
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface EnvUserPagedResult {
  totalCount: number;
  items: IUserType[];
}
