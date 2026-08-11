import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IPolicy, policyRn, PolicyTypeEnum } from "@features/safe/iam/types/policy";
import { PolicyService } from "@services/policy.service";
import { copyToClipboard } from '@utils/index';

@Component({
    selector: 'user-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
})
export class SettingComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private policyService: PolicyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
       const policyId = decodeURIComponent(paramMap.get('id'));
      this.getPolicy(policyId);
    })
  }

  isLoading = true;
  isReadonly = false;
  policy: IPolicy;
  private getPolicy(policyId: string) {
    this.policyService.get(policyId).subscribe(policy => {
      this.policy = policy;
      this.isLoading = false;
      if (policy.type == PolicyTypeEnum.SysManaged) this.isReadonly = true;
    }, () => this.isLoading = false);
  }

  resourceName() {
   return policyRn(this.policy);
  }

  deletePolicy() {
    this.policyService.delete(this.policy.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.router.navigateByUrl(`/iam/policies`);
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
  }

  saveSettings() {
    this.policyService.updateSetting(this.policy).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, errResponse => this.message.error($localize `:@@common.operation-failed:Operation failed`));
  }

  isEditingTitle = false;
  isEditingDescription = false;

  saveTitle() {
    this.toggleTitleEditState();
    this.saveSettings();
  }

  saveDescription() {
    this.toggleDescriptionEditState();
    this.saveSettings();
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    this.isEditingDescription = !this.isEditingDescription;
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
