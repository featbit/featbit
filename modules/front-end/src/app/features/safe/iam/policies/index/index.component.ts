import { Component, OnInit } from '@angular/core';
import { copyToClipboard, encodeURIComponentFfc } from '@utils/index';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { IPagedPolicy, IPolicy, PolicyFilter, policyRn } from "@features/safe/iam/types/policy";
import { PolicyService } from "@services/policy.service";

@Component({
  selector: 'iam-users',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private policyService: PolicyService
  ) { }

  private search$ = new Subject();

  isLoading: boolean = true;
  filter: PolicyFilter = new PolicyFilter();
  policies: IPagedPolicy = {
    items: [],
    totalCount: 0
  };

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getPolicies();
    });

    this.search$.next(null);
  }

  getPolicies() {
    this.isLoading = true;
    this.policyService.getList(this.filter).subscribe(policies => {
      this.policies = policies;
      this.isLoading = false;
    }, () => this.isLoading = false);
  }

  resourceName(policy: IPolicy) {
    return policyRn(policy);
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  policyDrawerVisible: boolean = false;
  showPolicyDrawer(){
    this.policyDrawerVisible = true;
  }
  policyDrawerClosed(created: any) {
    this.policyDrawerVisible = false;

    if (created) {
      this.getPolicies();
    }
  }

  navigateToDetail(id: string) {
    this.router.navigateByUrl(`/iam/policies/${encodeURIComponentFfc(id)}/permission`);
  }

  delete(policy: IPolicy) {
    this.policyService.delete(policy.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.policies.items = this.policies.items.filter(it => it.id !== policy.id);
      this.policies.totalCount--;
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
