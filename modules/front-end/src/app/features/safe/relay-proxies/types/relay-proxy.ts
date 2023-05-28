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
  items: RelayProxy[];
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
  syncAt?: Date;
  status?: AgentStatusEnum; // UI only
}

export class RelayProxy {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public scopes: RelayProxyScope[],
    public agents: RelayProxyAgent[],
    public key?: string) {
  }
  get healthyAgentCount() {
    return this.agents.filter((agent) => agent.status === AgentStatusEnum.Healthy).length;
  }
}
