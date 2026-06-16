import { IUserType, PageCursor } from "@shared/types";

export class EnvUserFilter {
  searchText?: string;
  cursor?: PageCursor;
  pageSize?: number;

  constructor(
    searchText?: string,
    cursor?: PageCursor,
    pageSize: number = 10){
    this.searchText = searchText ?? '';
    this.cursor = cursor;
    this.pageSize = pageSize;
  }
}

export class EnvUserSearchFilter {
  searchText?: string;
  excludedKeyIds?: string[];
  globalUserOnly?: boolean;
  limit: number;

  constructor(
    searchText?: string,
    excludedKeyIds?: string[],
    globalUserOnly?: boolean,
    limit: number = 5) {
    this.searchText = searchText ?? '';
    this.excludedKeyIds = excludedKeyIds ?? [];
    this.globalUserOnly = globalUserOnly ?? false;
    this.limit = limit;
  }
}

export interface EnvUserPagedResult {
  items: IUserType[];
  previousCursor?: PageCursor;
  nextCursor?: PageCursor;
}
