import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { MemberService } from "@services/member.service";
import { InheritedMemberPolicyFilter, IPagedInheritedMemberPolicy } from "@features/safe/iam/types/member";

@Component({
  selector: 'inherited-policies',
  templateUrl: './inherited-policies.component.html',
  styleUrls: ['./inherited-policies.component.less']
})
export class InheritedPoliciesComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private memberService: MemberService,
  ) { }

  memberId: string = '';
  private search$ = new Subject();

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.memberId = decodeURIComponent(paramMap.get('id'));
    });

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getPolicies();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  filter: InheritedMemberPolicyFilter = new InheritedMemberPolicyFilter();
  policies: IPagedInheritedMemberPolicy = {
    items: [],
    totalCount: 0
  };

  getPolicies() {
    this.isLoading = true;

    this.memberService.getInheritedPolicies(this.memberId, this.filter).subscribe(policies => {
      this.isLoading = false;
      this.policies = policies;
    }, () => this.isLoading = false);
  }

  doSearch(isDirectPolicies: boolean, resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(isDirectPolicies);
  }

  navigateToPolicy(policyId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/policies/${encodeURIComponentFfc(policyId)}/permission`])
    );

    window.open(url, '_blank');
  }
}
