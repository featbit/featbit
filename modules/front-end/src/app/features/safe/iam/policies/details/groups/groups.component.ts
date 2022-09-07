import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { IPagedPolicyGroup, PolicyGroupFilter } from "@features/safe/iam/types/policy";
import { GroupService } from "@services/group.service";
import { PolicyService } from "@services/policy.service";

@Component({
  selector: 'groups',
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.less']
})
export class GroupsComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private policyService: PolicyService,
    private groupService: GroupService,
    private message: NzMessageService
  ) { }

  policyId: string = '';
  private search$ = new Subject();

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.policyId = decodeURIComponent(paramMap.get('id'));
    })

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getGroups();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  filter: PolicyGroupFilter = new PolicyGroupFilter();
  groups: IPagedPolicyGroup = {
    items: [],
    totalCount: 0
  };

  getGroups() {
    this.isLoading = true;
    this.policyService.getGroups(this.policyId, this.filter).subscribe(groups => {
      this.groups = groups;
      this.isLoading = false;
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addPolicy(groupId: string) {
    this.groupService.addPolicy(groupId, this.policyId).subscribe(() => {
      this.groups.items = this.groups.items.map(item => {
        if (item.id === groupId) {
          item.isPolicyGroup = true;
        }

        return item;
      });

      this.message.success('添加成功');
    }, () => this.message.error('添加失败'));
  }

  removePolicy(groupId: string) {
    this.groupService.removePolicy(groupId, this.policyId).subscribe(() => {
      this.groups.items = this.groups.items.map(item => {
        if (item.id === groupId) {
          item.isPolicyGroup = false;
        }

        return item;
      });

      this.message.success('移除成功');
    }, () => this.message.error('移除失败'));
  }

  navigateToGroup(groupId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/groups/${encodeURIComponentFfc(groupId)}/users`])
    );

    window.open(url, '_blank');
  }
}
