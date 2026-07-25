export type FlagVariationType =
  "boolean" | "string" | "number" | "json" | string

export type FlagUser = {
  id?: string
  name?: string
  email?: string
}

export type FlagLastChange = {
  operator?: FlagUser
  happenedAt: string
  comment?: string
}

export type FlagServingOverview = {
  disabledVariation?: string
  enabledVariations?: string[]
}

export type FeatureFlag = {
  id: string
  name: string
  key: string
  description?: string
  tags: string[]
  isEnabled: boolean
  createdAt: string
  updatedAt: string
  variationType: FlagVariationType
  serves?: FlagServingOverview
  creator?: FlagUser
  lastChange?: FlagLastChange
}

export type PagedFeatureFlags = {
  items: FeatureFlag[]
  totalCount: number
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

export type FlagListFilter = {
  name: string
  tags: string[]
  isEnabled?: boolean
  isArchived: boolean
  sortBy: "created_at" | "key"
  pageIndex: number
  pageSize: number
}

export type CopyPrecheckResult = {
  id: string
  keyCheck: boolean
  targetUserCheck: boolean
  targetRuleCheck: boolean
  newProperties: string[]
  passed: boolean
}

export type FlagCreationPayload = {
  name: string
  key: string
  description: string
  tags: string[]
  isEnabled: boolean
  variationType: "boolean" | "string" | "number" | "json"
  enabledVariationId: string
  disabledVariationId: string
  variations: Array<{ id: string; name: string; value: string }>
}

export type FlagComparisonVariation = {
  id: string
  name?: string
  value: string
}

export type FlagComparisonRule = {
  id?: string
  name?: string
  conditions?: Array<Record<string, unknown>>
  variations?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type FlagComparisonTargetUsers = {
  variationId: string
  keyIds: string[]
}

export type FlagComparisonFallthrough = {
  variations?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type FlagComparisonValue = {
  id: string
  name: string
  key: string
  isEnabled: boolean
  variations: FlagComparisonVariation[]
  targetUsers: FlagComparisonTargetUsers[]
  rules: FlagComparisonRule[]
  fallthrough: FlagComparisonFallthrough | null
  disabledVariationId: string
}

export type FlagComparisonDetail = {
  source: FlagComparisonValue
  target: FlagComparisonValue
  diff: {
    onOffState: {
      source: boolean
      target: boolean
      isDifferent: boolean
    }
    individualTargeting: Array<{ isDifferent: boolean }>
    targetingRule: Array<{ isDifferent: boolean }>
    defaultRule: { isDifferent: boolean }
    offVariation: { isDifferent: boolean }
  }
  relatedSegments: Array<{ key: string; value: string }>
  isRulesCopyable: boolean
}

export type FlagSettingCopyMode = "append" | "overwrite"

export type FlagSettingCopyOptions = {
  onOffState: boolean
  individualTargeting: {
    copy: boolean
    mode: FlagSettingCopyMode
  }
  targetingRule: {
    copy: boolean
    mode: FlagSettingCopyMode
  }
  defaultRule: boolean
  offVariation: boolean
}
