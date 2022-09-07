import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { GroupService } from "@services/group.service";
import { GroupPolicyFilter, IPagedGroupPolicy } from "@features/safe/iam/types/group";

@Component({
  selector: 'policies',
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.less']
})
export class PoliciesComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private groupService: GroupService,
    private message: NzMessageService
  ) { }

  groupId: string = '';
  private search$ = new Subject();

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      this.groupId = decodeURIComponent(paramMap.get('id'));
    });

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getPolicies();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  filter: GroupPolicyFilter = new GroupPolicyFilter();
  policies: IPagedGroupPolicy = {
    items: [],
    totalCount: 0
  };

  getPolicies() {
    this.isLoading = true;
    this.groupService.getPolicies(this.groupId, this.filter).subscribe(policies => {
      this.policies = policies;
      this.isLoading = false;
    }, () => this.isLoading = false);
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addPolicy(policyId: string) {
    this.groupService.addPolicy(this.groupId, policyId).subscribe(() => {
      this.policies.items = this.policies.items.map(item => {
        if (item.id === policyId) {
          item.isGroupPolicy = true;
        }

        return item;
      });

      this.message.success('添加成功');
    }, () => this.message.error('添加失败'));
  }

  removePolicy(policyId: string) {
    this.groupService.removePolicy(this.groupId, policyId).subscribe(() => {
      this.policies.items = this.policies.items.map(item => {
        if (item.id === policyId) {
          item.isGroupPolicy = false;
        }

        return item;
      });

      this.message.success('移除成功');
    }, () => this.message.error('移除失败'));
  }

  navigateToPolicyDetail(policyId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/policies/${encodeURIComponentFfc(policyId)}/permission`])
    );

    window.open(url, '_blank');
  }
}
