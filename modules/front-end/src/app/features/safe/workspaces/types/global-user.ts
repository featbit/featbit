export interface GlobalUser {
  id: string;
  name: string;
  keyId: string;
  customizedProperties: [{ name: string, value: string }];
}

export class GlobalUserFilter {
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

export class PagedGlobalUser {
  totalCount: number;
  items: GlobalUser[];
}
