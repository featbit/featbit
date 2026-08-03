export type AccessTokenType = "Personal" | "Service"

export type AccessTokenStatus = "Active" | "Inactive"

export type PolicyEffect = "allow" | "deny"

export type ResourceType =
  "flag" | "segment" | "project" | "env" | "iam" | "workspace"

export type PolicyStatement = {
  id: string
  resourceType: ResourceType | "*" | string
  effect: PolicyEffect | string
  actions: string[]
  resources: string[]
}

export type UserPolicy = {
  id?: string
  name: string
  type: string
  statements?: PolicyStatement[]
}

export type AccessTokenCreator = {
  id: string
  name?: string
  email?: string
}

export type AccessToken = {
  id: string
  name: string
  type: AccessTokenType
  creator?: AccessTokenCreator
  status?: AccessTokenStatus
  token?: string
  permissions?: PolicyStatement[]
  lastUsedAt?: string | null
}

export type PagedAccessTokens = {
  totalCount: number
  items: AccessToken[]
}

export type PolicyResource = {
  id: string
  name: string
  rn: string
  type: string
}

export type PermissionCategoryState = {
  selectedActions: string[]
  scope: "all" | "specific"
  specificResources: string[]
}

export type PermissionDraft = Record<ResourceType, PermissionCategoryState>

export type AccessTokenPayload = {
  name: string
  type: AccessTokenType
  permissions: PolicyStatement[]
}

export type AccessTokenSheetMode = "new" | "edit" | "view"
