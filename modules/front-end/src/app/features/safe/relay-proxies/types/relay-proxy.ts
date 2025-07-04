export class RelayProxyFilter {
  name?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface PagedRelayProxy {
  totalCount: number;
  items: RelayProxy[];
}

interface RelayProxyBase {
  name: string;
  description: string;
  isAllEnvs: boolean;
  scopes: string[];
  agents: RelayProxyAgent[];
}

export interface RelayProxy extends RelayProxyBase {
  id: string;
  key: string;
  serves: string[];
  autoAgents: RelayProxyAutoAgent[];
  updatedAt?: Date;

  // for ui
  parsedServes?: { id: string; pathName: string }[];
}

export interface RelayProxyAgent {
  id: string;
  name: string;
  host: string;
  syncAt?: Date;

  // for ui
  isChecking?: boolean;
  isSyncing?: boolean;
}

export interface AutoAgentStatus {
  serves: string;
  reportedAt: Date;
  syncState: string;
  lastSyncedAt: Date;
  dataVersion: number
}

export interface RelayProxyAutoAgent {
  id: string;
  status: AutoAgentStatus | string;
  registeredAt: Date;
}

export interface UpsertRelayProxyPayload extends RelayProxyBase {
  autoAgents: RelayProxyAutoAgent[];
}

export interface SyncAgentResult {
  success: boolean;
  syncAt?: Date;
  reason: string;
}
