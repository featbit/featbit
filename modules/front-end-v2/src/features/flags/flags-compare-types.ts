export type FlagDiffOverview = {
  targetEnvId: string
  onOffState: boolean
  individualTargeting: boolean
  targetingRule: boolean
  defaultRule: boolean
  offVariation: boolean
}

export type FlagCompareOverview = {
  id: string
  name: string
  key: string
  description: string
  tags: string[]
  diffs: FlagDiffOverview[]
}

export type PagedFlagCompareOverview = {
  items: FlagCompareOverview[]
  totalCount: number
}

export type CompareEnvironment = {
  id: string
  projectId: string
  projectName: string
  environmentName: string
  label: string
}

export type CompareOverviewRequest = {
  envId: string
  targetEnvIds: string[]
  name: string
  tags: string[]
  sortBy: "created_at" | "key"
  pageIndex: number
  pageSize: number
}
