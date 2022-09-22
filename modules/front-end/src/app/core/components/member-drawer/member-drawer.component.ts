import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberValidator } from "@utils/form-validators";
import { MemberService } from "@services/member.service";
import { PolicyService } from "@services/policy.service";
import { IPagedPolicy, PolicyFilter } from "@features/safe/iam/types/policy";
import { GroupListFilter, IPagedGroup } from "@features/safe/iam/types/group";
import { GroupService } from "@services/group.service";

@Component({
  selector: 'app-member-drawer',
  templateUrl: './member-drawer.component.html',
  styleUrls: ['./member-drawer.component.less']
})
export class MemberDrawerComponent {

  isPoliciesLoading = true;
  policyFilter: PolicyFilter = new PolicyFilter(null, 1, 50);

  policies: IPagedPolicy = {
    items: [],
    totalCount: 0
  };

  isGroupsLoading = true;
  groupFilter: GroupListFilter = new GroupListFilter(null, 1, 50);
  groups: IPagedGroup = {
    items: [],
    totalCount: 0
  };

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  memberForm: FormGroup;
  constructor(
    private fb: FormBuilder,
    private memberService: MemberService,
    private message: NzMessageService,
    private policyService: PolicyService,
    private groupService: GroupService
  ) {

    this.getPolicies();
    this.getGroups();

    this.memberForm = this.fb.group({
      identityType: ['phoneNumber', [Validators.required]],
      identity: ['', [phoneNumberValidator, Validators.required]],
      policyId: [''],
      groupId: [''],
      name: ''
    });
  }

  getPolicies(query?: string) {
    this.policyFilter.name = query || '';

    this.isPoliciesLoading = true;
    this.policyService.getList(this.policyFilter).subscribe(policies => {
      this.policies = policies;
      this.isPoliciesLoading = false;
    }, () => this.isPoliciesLoading = false);
  }

  getGroups(query?: string) {
    this.groupFilter.name = query || '';

    this.isGroupsLoading = true;
    this.groupService.getList(this.groupFilter).subscribe(groups => {
      this.groups = groups;
      this.isGroupsLoading = false;
    }, () => this.isGroupsLoading = false);
  }

  onIdentityTypeChange(identityType) {
    const control = this.memberForm.get('identity');

    if (identityType === 'email') {
      control.setValidators([Validators.email, Validators.required]);
    }

    if (identityType === 'phoneNumber') {
      control.setValidators([phoneNumberValidator, Validators.required]);
    }

    control.updateValueAndValidity();
  }

  onClose() {
    this.isPermissionInvalid = false;
    this.memberForm.reset({ identityType: 'phoneNumber' });
    this.close.emit();
  }

  isPermissionInvalid = false;
  validatePermissions(): boolean {
    let { policyId, groupId } = this.memberForm.value;

    if ((policyId === null || policyId.length === 0) && (groupId === null || groupId.length === 0)) {
      this.isPermissionInvalid = true;
      return false;
    }

    this.isPermissionInvalid = false;
    return true;
  }

  isLoading: boolean = false;
  doSubmit() {
    if (this.memberForm.invalid) {
      for (const i in this.memberForm.controls) {
        this.memberForm.controls[i].markAsDirty();
        this.memberForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    if (!this.validatePermissions()) {
      return;
    }

    let { policyId, groupId, identity, identityType, name } = this.memberForm.value;
    const policyIds = !!policyId ? [policyId] : [];
    const groupIds = !!groupId ? [groupId] : [];

    this.isLoading = true;
    this.memberService.create({identity, identityType, policyIds, groupIds, name, role: 'Admin'}).subscribe(
      () => {
        this.isLoading = false;
        this.close.emit(true);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      },
      _ => {
        this.isLoading = false;
      }
    )
  }
}
