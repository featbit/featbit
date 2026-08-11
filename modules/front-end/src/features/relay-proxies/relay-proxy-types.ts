export type RelayProxySheetMode = "new" | "edit" | "view"

export type RelayProxyAgent = {
  id: string
  name: string
  host: string
  syncAt?: string
  serves: string
  dataVersion?: number
  createdAt?: string
}

export type RelayProxyAutoAgent = {
  id: string
  status: string | RelayProxyAutoAgentStatus
  registeredAt: string
}

export type RelayProxyAutoAgentStatus = {
  serves?: string
  reportedAt?: string
  syncState?: string
  lastSyncedAt?: string
  dataVersion?: number
}

export type RelayProxy = {
  id: string
  name: string
  key: string
  description: string
  isAllEnvs: boolean
  scopes: string[]
  serves: string[]
  agents: RelayProxyAgent[]
  autoAgents: RelayProxyAutoAgent[]
  updatedAt?: string
}

export type RelayProxyPayload = Pick<
  RelayProxy,
  "name" | "description" | "isAllEnvs" | "scopes" | "agents" | "autoAgents"
>

export type PagedRelayProxies = {
  totalCount: number
  items: RelayProxy[]
}

export type EnvironmentResource = {
  id: string
  name: string
  pathName: string
  rn: string
  type: string
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

export type AgentAvailability = number

export type SyncAgentResult = {
  success: boolean
  syncAt?: string
  serves: string
  dataVersion: number
  reason: string
}
