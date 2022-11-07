import { IVariation } from "@shared/rules";

export interface IEndUserFlag {
  name: string
  key: string
  variationType: string
  variations: IVariation[]
  matchVariation: string
  matchReason: string
}

export interface IEndUserSegment {
  id: string
  name: string
  updatedAt: Date
}
