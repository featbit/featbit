import { IUserType } from "@shared/types";

export class EnvUserFilter {
  searchText?: string;
  properties?: string[];
  pageIndex: number;
  pageSize: number;

  constructor(
    searchText?: string,
    properties?: string[],
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.searchText = searchText ?? '';
    this.properties = properties ?? [];
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface EnvUserPagedResult {
  totalCount: number;
  items: IUserType[];
}
