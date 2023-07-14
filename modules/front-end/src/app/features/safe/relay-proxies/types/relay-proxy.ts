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
  Unknown = 'unknown',
  Unreachable = 'unreachable',
  Unauthorized = 'unauthorized',
  Loading = 'loading'
}

export enum ProxyStatusEnum {
  Healthy = 'proxy-healthy', // all agents are healthy
  Sick = 'proxy-sick', // at least one but not all the agents are unhealthy
  Unhealthy = 'proxy-unhealthy', // all agents are unhealthy
}

export class RelayProxyScope {
  id: string;
  projectId: string;
  envIds: string[]
}

export class RelayProxyAgent {
  id: string;
  name: string;
  host: string;
  syncAt?: Date;
  status?: AgentStatusEnum; // UI only
}

export class RelayProxy {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public isAllEnvs: boolean,
    public scopes: RelayProxyScope[],
    public agents: RelayProxyAgent[],
    public key?: string) {
  }
  get healthyAgentCount(): number {
    return this.agents.filter((agent) => agent.status === AgentStatusEnum.Healthy).length;
  }

  get healthyStatus(): ProxyStatusEnum {
    switch (this.agents.length - this.healthyAgentCount) {
      case 0:
        return ProxyStatusEnum.Healthy;
      case this.agents.length:
        return ProxyStatusEnum.Unhealthy;
      default:
        return ProxyStatusEnum.Sick;
    }
  }
}
