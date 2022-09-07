import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { IPagedMemberPolicy, MemberPolicyFilter } from "@features/iam/types/member";
import { MemberService } from "@services/member.service";

@Component({
  selector: 'direct-policies',
  templateUrl: './direct-policies.component.html',
  styleUrls: ['./direct-policies.component.less']
})
export class DirectPoliciesComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private memberService: MemberService,
    private message: NzMessageService
  ) { }

  memberId: string = '';
  private search$ = new Subject();

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      this.memberId = decodeURIComponent(paramMap.get('id'));
    })

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getPolicies();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  filter: MemberPolicyFilter = new MemberPolicyFilter();
  policies: IPagedMemberPolicy = {
    items: [],
    totalCount: 0
  };

  getPolicies() {
    this.isLoading = true;

    this.memberService.getDirectPolicies(this.memberId, this.filter).subscribe(policies => {
      this.policies = policies;
      this.isLoading = false;
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addPolicy(policyId: string) {
    this.memberService.addPolicy(this.memberId, policyId).subscribe(() => {
      this.policies.items = this.policies.items.map(item => {
        if (item.id === policyId) {
          item.isMemberPolicy = true;
        }

        return item;
      });

      this.message.success('添加成功');
    }, () => this.message.error('添加失败'));
  }

  removePolicyFrom(policyId: string) {
    this.memberService.removePolicy(this.memberId, policyId).subscribe(() => {
      this.policies.items = this.policies.items.map(item => {
        if (item.id === policyId) {
          item.isMemberPolicy = false;
        }

        return item;
      });

      this.message.success('移除成功');
    }, () => this.message.error('移除失败'));
  }

  navigateToPolicy(policyId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/policies/${encodeURIComponentFfc(policyId)}/permission`])
    );

    window.open(url, '_blank');
  }
}
