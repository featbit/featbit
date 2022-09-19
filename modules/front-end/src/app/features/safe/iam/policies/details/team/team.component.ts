import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { MemberService } from "@services/member.service";
import { PolicyService } from "@services/policy.service";
import { IPagedPolicyMember, PolicyMemberFilter } from "@features/safe/iam/types/policy";

@Component({
  selector: 'policies-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.less']
})
export class TeamComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private policyService: PolicyService,
    private memberService: MemberService,
    private message: NzMessageService
  ) { }

  policyId: string = '';
  private search$ = new Subject();
  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.policyId = decodeURIComponent(paramMap.get('id'));
    });

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getMembers();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  filter: PolicyMemberFilter = new PolicyMemberFilter();
  members: IPagedPolicyMember = {
    items: [],
    totalCount: 0
  };

  getMembers() {
    this.isLoading = true;

    this.policyService.getMembers(this.policyId, this.filter).subscribe(members => {
      this.members = members;
      this.isLoading = false;
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addPolicy(userId: string) {
    this.memberService.addPolicy(userId, this.policyId).subscribe(() => {
      this.members.items = this.members.items.map(it => {
        if (it.id === userId) {
          it.isPolicyMember = true;
        }

        return it;
      });

      this.message.success('添加成功');
    }, () => this.message.error('添加失败'));
  }

  removePolicy(userId: string) {
    this.memberService.removePolicy(userId, this.policyId).subscribe(() => {
      this.members.items = this.members.items.map(item => {
        if (item.id === userId) {
          item.isPolicyMember = false;
        }

        return item;
      });

      this.message.success('移除成功');
    }, () => this.message.error('移除失败'));
  }

  navigateToMember(userId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/users/${encodeURIComponentFfc(userId)}/groups`])
    );

    window.open(url, '_blank');
  }
}
