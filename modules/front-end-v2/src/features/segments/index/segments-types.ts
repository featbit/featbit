export type SegmentType = "environment-specific" | "shared"

export type Segment = {
  id: string
  name: string
  key: string
  type: SegmentType
  scopes: string[]
  tags: string[]
  description: string
  updatedAt: string
  isArchived: boolean
}

export type PagedSegments = {
  items: Segment[]
  totalCount: number
}

export type SegmentPayload = {
  name: string
  key: string
  type: SegmentType
  scopes: string[]
  description: string
}

export type SegmentFlagReference = {
  envId: string
  id: string
  name: string
  key: string
}

export type ScopeResource = {
  id: string
  name: string
  pathName: string
  rn: string
  type: "organization" | "project" | "env"
}

export type UserPolicy = {
  type: string
  statements: Array<{
    resourceType: string
    effect: string
    actions: string[]
    resources: string[]
  }>
}

export type EnvironmentSettings = {
  requireChangeComment: boolean
}
