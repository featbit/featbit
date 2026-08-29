export type LayerStatus = "active" | "archived"

export type LayerRunStatus = "draft" | "collecting" | "analyzing" | string

export type LayerRunSummary = {
  id: string
  experimentId?: string
  experimentName: string
  key: string
  start: number
  end: number
  status: LayerRunStatus
  assignmentUnitSelector?: string
  includedInAllocation: boolean
}

export type LayerAllocationOverlap = {
  start: number
  end: number
  runIds: string[]
}

export type LayerAllocationSummary = {
  activeRunCount: number
  reservedPercent: number
  freePercent: number
  overlaps: LayerAllocationOverlap[]
  mixedAssignmentUnits: boolean
  overAllocated: boolean
  status:
    | "no-conflicts"
    | "overlap"
    | "mixed-assignment-units"
    | "over-allocated"
    | string
}

export type Layer = {
  id: string
  featBitEnvId: string
  name: string
  key: string
  description?: string | null
  assignmentUnitSelector: string
  status: LayerStatus
  createdAt: string
  updatedAt: string
  experimentRuns?: LayerRunSummary[]
  allocationSummary?: LayerAllocationSummary
}

export type PagedLayers = {
  items: Layer[]
  totalCount: number
}

export type LayerPayload = {
  name: string
  key: string
  description: string
  assignmentUnitSelector: string
}

export type LayerUpdatePayload = Omit<LayerPayload, "key">
