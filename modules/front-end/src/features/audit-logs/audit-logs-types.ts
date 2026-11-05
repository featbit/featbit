export type AuditLogRefType = "FeatureFlag" | "Segment" | string

export type AuditInstruction = {
  kind: string
  value: unknown
}

export type AuditDataChange = {
  previous?: string
  current?: string
}

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

export const AuditLogScopes = {
  Environment: "Environment",
  Organization: "Organization",
  Workspace: "Workspace",
} as const

export type AuditLogScope = (typeof AuditLogScopes)[keyof typeof AuditLogScopes]

export type AuditLogQueryFilter = {
  scope: AuditLogScope
  scopeId: string
  crossEnvironment?: boolean
  query?: string
  creatorId?: string
  refTypes?: string[]
  refId?: string
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
