import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPolicy } from "@features/safe/iam/types/policy";
import { PolicyService } from "@services/policy.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { IPolicyStatement } from "@shared/policy";

@Component({
  selector: 'permission',
  templateUrl: './permission.component.html',
  styleUrls: ['./permission.component.less']
})
export class PermissionComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private policyService: PolicyService,
    private message: NzMessageService
  ) { }

  isLoading: boolean = true;
  policy: IPolicy;

  ngOnInit() {
    this.route.paramMap.subscribe(paramMap => {
      const policyId = decodeURIComponent(paramMap.get('id'));
      this.getPolicy(policyId);
    })
  }

  private getPolicy(policyId: string) {
    this.isLoading = true;
    this.policyService.get(policyId).subscribe(policy => {
      this.policy = policy;
      this.isLoading = false;
    }, () => this.isLoading = false);
  }

  saveStatements(statements: IPolicyStatement[]) {
    this.policyService.updateStatements(this.policy.id, statements).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, _ => this.message.error($localize `:@@common.operation-failed:Operation failed`));
  }
}
