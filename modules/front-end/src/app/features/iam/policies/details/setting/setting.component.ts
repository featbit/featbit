import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { IPolicy, policyRn } from "@features/iam/types/policy";
import { PolicyService } from "@services/policy.service";

@Component({
  selector: 'user-setting',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.less']
})
export class SettingComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private policyService: PolicyService,
    private modal: NzModalService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
       const policyId = decodeURIComponent(paramMap.get('id'));
      this.getPolicy(policyId);
    })
  }

  isLoading = true;
  policy: IPolicy;
  private getPolicy(policyId: string) {
    this.policyService.get(policyId).subscribe(policy => {
      this.policy = policy;
      this.isLoading = false;
    }, () => this.isLoading = false);
  }

  resourceName() {
   return policyRn(this.policy);
  }

  deletePolicy() {
    this.policyService.delete(this.policy.id).subscribe(() => {
      this.message.success(`刪除成功`);
      this.router.navigateByUrl(`/iam/policies`);
    }, () => this.message.error('操作失败'))
  }

  saveSettings() {
    this.policyService.updateSetting(this.policy).subscribe(() => {
      this.message.success("更新成功!");
    }, errResponse => this.message.error(errResponse.error));
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
    navigator.clipboard.writeText(text).then(
      () => this.message.success('复制成功')
    );
  }
}
