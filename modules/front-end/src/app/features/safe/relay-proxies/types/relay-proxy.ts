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

export interface IPagedRelayProxy {
  totalCount: number;
  items: IRelayProxy[];
}

export enum AgentStatusEnum {
  Healthy = 'healthy',
  Unhealthy = 'unhealthy',
  None = 'none',
  Loading = 'loading'
}

export class RelayProxyScope {
  id: string;
  projectId: string;
  envIds: string[]
}

export class RelayProxyAgent {
  id: string;
  name: string;
  key?: string;
  host: string;
  syncAt?: Date
}

export interface IRelayProxy {
  id?: string,
  name: string,
  description: string,
  scopes: RelayProxyScope[],
  agents: RelayProxyAgent[]
}
