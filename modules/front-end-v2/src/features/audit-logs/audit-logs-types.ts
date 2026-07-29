export type AuditLogRefType = "FeatureFlag" | "Segment" | string

export type AuditInstruction = {
  kind: string
  value: unknown
}

export type AuditDataChange = { previous?: string; current?: string }

export type ChangeRequestDecisionAuditSnapshot = {
  changeRequestId: string
  requestComment: string | null
  proposedDataChange: AuditDataChange | null
}

export type AuditLog = {
  id: string
  refId: string
  refType: AuditLogRefType
  operation: string
  creatorId: string
  creatorName: string
  creatorEmail: string
  createdAt: string
  comment: string
  dataChange: AuditDataChange
  instructions: AuditInstruction[]
}

export type PagedAuditLogs = {
  items: AuditLog[]
  totalCount: number
}

export type AuditUser = {
  id: string
  name: string
  email: string
}

export type AuditLogFilters = {
  query: string
  creatorId?: string
  refType?: string
  refId?: string
  crossEnvironment?: boolean
  from?: number
  to?: number
}

export type AuditObjectIdentity = {
  id: string
  name: string
  key: string
  removed: boolean
  available: boolean
}
