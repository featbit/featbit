import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';
import { RelayProxyService } from "@services/relay-proxy.service";
import {
  PagedRelayProxy,
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
  filter: RelayProxyFilter = new RelayProxyFilter();

  rps: PagedRelayProxy = {
    items: [],
    totalCount: 0
  };

  canManageRp: boolean = false;

  selectedRp: RelayProxy | null = null;
  drawerVisible: boolean = false;
  openDrawer(rp: RelayProxy) {
    this.selectedRp = rp;
    this.drawerVisible = true;
  }
  closeDrawer(hasChanged: boolean = false) {
    this.selectedRp = null;
    this.drawerVisible = false;

    if (hasChanged) {
      this.doSearch();
    }
  }

  constructor(
    private message: NzMessageService,
    private permissionsService: PermissionsService,
    private rpService: RelayProxyService
  ) { }

  ngOnInit(): void {
    this.canManageRp = this.permissionsService.isGranted(generalResourceRNPattern.relayProxy, permissionActions.ManageRelayProxies);

    this.$search.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getRelayProxies();
    });
  }

  getRelayProxies() {
    this.isLoading = true;
    this.rpService.getList(this.filter)
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: rps => this.rps = {
        items: rps.items.map(rp => ({
          ...rp,
          parsedServes: rp.serves.map(serve => {
            const index = serve.indexOf(',');
            return {
              id: serve.substring(0, index),
              pathName: serve.substring(index + 1)
            };
          })
        })),
        totalCount: rps.totalCount
      },
      error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`)
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }
    this.$search.next(null);
  }

  delete(relayProxy: RelayProxy) {
    this.rpService.delete(relayProxy.id).subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.rps.items = this.rps.items.filter(it => it.id !== relayProxy.id);
        this.rps.totalCount--;
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    })
  }
}
