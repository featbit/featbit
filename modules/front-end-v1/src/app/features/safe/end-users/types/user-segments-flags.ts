import { IVariation } from "@shared/rules";

export interface IEndUserFlag {
  name: string
  key: string
  variationType: string
  variations: IVariation[]
  matchVariation: string
  matchReason: string
}

export interface IPagedEndUserFlag {
  totalCount: number
  items: IEndUserFlag[]
}

export class EndUserFlagFilter {
  searchText: string
  pageIndex: number
  pageSize: number

  constructor(
    searchText?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.searchText = searchText ?? ''
    this.pageIndex = pageIndex
    this.pageSize = pageSize
  }
}

export interface IEndUserSegment {
  id: string
  name: string
  type: string
  updatedAt: Date
}
