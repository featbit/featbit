import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import { PolicyService } from "@services/policy.service";
import { IPagedPolicy, PolicyFilter } from "@features/safe/iam/types/policy";
import { GroupListFilter, IPagedGroup } from "@features/safe/iam/types/group";
import { GroupService } from "@services/group.service";
import {OrganizationService} from "@services/organization.service";

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
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private policyService: PolicyService,
    private groupService: GroupService
  ) {
    this.getPolicies();
    this.getGroups();

    this.memberForm = this.fb.group({
      email: ['', [phoneNumberOrEmailValidator, Validators.required]],
      policyId: [''],
      groupId: ['']
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

  onClose() {
    this.isPermissionInvalid = false;
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

    let { policyId, groupId, email } = this.memberForm.value;
    const policyIds = !!policyId ? [policyId] : [];
    const groupIds = !!groupId ? [groupId] : [];
    const method = 'Email';

    this.isLoading = true;
    this.organizationService.addUser({ method, email, policyIds, groupIds }).subscribe(
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
