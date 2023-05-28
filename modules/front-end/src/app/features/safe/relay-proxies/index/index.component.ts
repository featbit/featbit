import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { RelayProxyService } from "@services/relay-proxy.service";
import { IPagedRelayProxy, IRelayProxy, RelayProxyFilter } from "@features/safe/relay-proxies/types/relay-proxy";
import { NzMessageService } from "ng-zorro-antd/message";


@Component({
  selector: 'relay-proxies',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {
  $search = new BehaviorSubject('');
  isLoading: boolean = true;
  proxyDetailvisible: boolean = false;

  filter: RelayProxyFilter = new RelayProxyFilter();
  relayProxies: IPagedRelayProxy = {
    items: [],
    totalCount: 0
  };

  constructor(
    private message: NzMessageService,
    private relayProxyService: RelayProxyService
  ) {
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
    this.relayProxyService.getList(this.filter).subscribe({
      next: (replayProxies) => {
        this.relayProxies = replayProxies;

        this.isLoading = false;
      },
      error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`),
      complete: () => this.isLoading = false
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }
    this.$search.next(null);
  }

  syncAgents(relayProxy: IRelayProxy) {

  }

  delete(relayProxy: IRelayProxy) {
    this.relayProxyService.delete(relayProxy.id).subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.relayProxies.items = this.relayProxies.items.filter(it => it.id !== relayProxy.id);
        this.relayProxies.totalCount--;
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    })
  }

  currentRelayProxy: IRelayProxy = {name: null, description: null, scopes: [], agents: []};
  createOrEdit(relayProxy: IRelayProxy = {name: null, description: null, scopes: [], agents: []}) {
    this.currentRelayProxy = {...relayProxy};
    this.proxyDetailvisible = true;
  }

  relayProxyDrawerClosed(data: any) { //{ isEditing: boolean, id: string, name: string, scopes: [], agents: [] }
    this.proxyDetailvisible = false;

    if (!data) {
      return;
    }

    if (!data.isEditing) {
      this.getRelayProxies();
    } else {
      this.relayProxies.items = this.relayProxies.items.map((rp) => {
        if (rp.id === data.id) {
          return { ...data };
        }

        return rp;
      })
    }
  }
}
