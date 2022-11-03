export interface IEndUserFlag {
  name: string
  key: string
  variationType: string
  variation: string
  variationDisplayOrder: string
  matchReason: string
}

export interface IEndUserSegment {
  id: string
  name: string
  updatedAt: Date
}
