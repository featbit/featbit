import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';
import { RelayProxyService } from "@services/relay-proxy.service";
import {
  AgentStatusEnum,
  IPagedRelayProxy,
  RelayProxy,
  RelayProxyFilter
} from "@features/safe/relay-proxies/types/relay-proxy";
import { NzMessageService } from "ng-zorro-antd/message";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";

@Component({
  selector: 'relay-proxies',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {
  $search = new BehaviorSubject('');
  isLoading: boolean = true;
  proxyDetailVisible: boolean = false;

  filter: RelayProxyFilter = new RelayProxyFilter();
  relayProxies: IPagedRelayProxy = {
    items: [],
    totalCount: 0
  };

  canMangeRelayProxies = false;

  constructor(
    private message: NzMessageService,
    private permissionsService: PermissionsService,
    private relayProxyService: RelayProxyService
  ) {
    this.canMangeRelayProxies = this.permissionsService.isGranted(generalResourceRNPattern.relayProxy, permissionActions.ManageRelayProxies);
  }

  ngOnInit(): void {
    this.$search.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getRelayProxies();
    });
  }

  getRelayProxies() {
    this.isLoading = true;
    this.relayProxyService.getList(this.filter)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (replayProxies) => {
          this.relayProxies = {
            ...replayProxies,
            items: replayProxies.items.map((proxy) => new RelayProxy(
              proxy.id,
              proxy.name,
              proxy.description,
              proxy.isAllEnvs,
              proxy.scopes,
              proxy.agents.map((agent) => ({ ...agent, status: AgentStatusEnum.Unknown })),
              proxy.key
            ))
          };

          this.fetchRelayProxiesStatus(this.relayProxies.items);
        },
        error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`)
      });
  }

  fetchRelayProxiesStatus(relayProxies: RelayProxy[]) {
    relayProxies.forEach((relayProxy) => {
      relayProxy.agents.forEach((agent) => {
        this.relayProxyService.getAgentStatus(relayProxy.id, agent.host).subscribe({
          next: (res) => {
            agent.status = res.type;
          },
          error: (_) => {
            agent.status = AgentStatusEnum.Unknown;
          }
        })
      })
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }
    this.$search.next(null);
  }

  delete(relayProxy: RelayProxy) {
    this.relayProxyService.delete(relayProxy.id).subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.relayProxies.items = this.relayProxies.items.filter(it => it.id !== relayProxy.id);
        this.relayProxies.totalCount--;
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    })
  }

  currentRelayProxy: RelayProxy = new RelayProxy(null, null, null, true, [], []);

  showDetailDrawer(relayProxy: RelayProxy = new RelayProxy(null, null, null, true, [], [])) {
    this.currentRelayProxy = new RelayProxy(relayProxy.id, relayProxy.name, relayProxy.description, relayProxy.isAllEnvs, relayProxy.scopes, relayProxy.agents);
    this.proxyDetailVisible = true;
  }

  relayProxyDrawerClosed(data: any) { //{ isEditing: boolean, id: string, name: string, scopes: [], agents: [] }
    this.proxyDetailVisible = false;

    if (!data) {
      return;
    }

    if (!data.isEditing) {
      this.getRelayProxies();
    } else {
      this.relayProxies.items = this.relayProxies.items.map((rp) => {
        if (rp.id === data.id) {
          const result = new RelayProxy(
            data.id,
            data.name,
            data.description,
            data.isAllEnvs,
            data.scopes,
            data.agents.map((agent) => ({ ...agent, status: AgentStatusEnum.Unknown })),
            rp.key);

          this.fetchRelayProxiesStatus([result]);
          return result;
        }

        return rp;
      });
    }
  }
}
