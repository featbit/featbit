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
  included: string[]
  excluded: string[]
  rules: SegmentRule[]
}

export type SegmentCondition = {
  id: string
  property: string
  op: string
  value: string
}

export type SegmentRule = {
  id: string
  name: string
  conditions: SegmentCondition[]
}

export type SegmentEndUser = {
  id: string
  envId: string | null
  keyId: string
  name: string
  customizedProperties?: Array<{ name: string; value: string }>
}

export type SegmentUserProperty = {
  id: string
  name: string
  presetValues: Array<{ id: string; value: string; description: string }>
  usePresetValuesOnly: boolean
  isBuiltIn: boolean
  isDigestField: boolean
  remark: string
}

export type AuditInstruction = {
  kind: string
  value: unknown
}

export type AuditLog = {
  id: string
  refId: string
  refType: string
  operation: string
  creatorId: string
  creatorName: string
  creatorEmail: string
  createdAt: string
  comment: string
  dataChange: { previous?: string; current?: string }
  instructions: AuditInstruction[]
}

export type PagedAuditLogs = {
  items: AuditLog[]
  totalCount: number
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
