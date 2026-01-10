import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import { PolicyService } from "@services/policy.service";
import { IPagedPolicy, PolicyFilter } from "@features/safe/iam/types/policy";
import { GroupListFilter, IPagedGroup } from "@features/safe/iam/types/group";
import { GroupService } from "@services/group.service";
import {OrganizationService} from "@services/organization.service";
import { finalize } from "rxjs/operators";

@Component({
    selector: 'app-member-drawer',
    templateUrl: './member-drawer.component.html',
    styleUrls: ['./member-drawer.component.less'],
    standalone: false
})
export class MemberDrawerComponent implements OnInit {
  private _visible: boolean = false;
  @Input()
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.form.reset();
    }
  }

  @Output() close: EventEmitter<boolean> = new EventEmitter();

  form: FormGroup;

  private formBuilder: FormBuilder = inject(FormBuilder);
  private organizationService: OrganizationService = inject(OrganizationService);
  private message: NzMessageService = inject(NzMessageService);
  private policyService: PolicyService = inject(PolicyService);
  private groupService: GroupService = inject(GroupService);

  ngOnInit() {
    this.form = this.formBuilder.group({
      email: [ '', [ phoneNumberOrEmailValidator, Validators.required ] ],
      permissions: this.formBuilder.group({
        policyId: [ [] ],
        groupId: [ [] ]
      }, { validators: this.permissionsValidator })
    });

    this.loadPolicies();
    this.loadGroups();
  }

  permissionsValidator: ValidatorFn = (group: FormGroup) => {
    const policyId = group.get('policyId').value;
    const groupId = group.get('groupId').value;

    if (!policyId && !groupId) {
      return { invalid: true };
    }

    return null;
  };

  isPoliciesLoading = true;
  policyFilter: PolicyFilter = new PolicyFilter(null, 1, 20);
  policies: IPagedPolicy = {
    items: [],
    totalCount: 0
  };
  loadPolicies(query?: string) {
    this.policyFilter.name = query || '';

    this.isPoliciesLoading = true;
    this.policyService.getList(this.policyFilter)
    .pipe(finalize(() => this.isPoliciesLoading = false))
      .subscribe({
        next: policies => this.policies = policies,
        error: () => this.message.error($localize`:@@iam.teams.failed-to-load-policies:Failed to load policies`)
      });
  }

  isGroupsLoading = true;
  groupFilter: GroupListFilter = new GroupListFilter(null, 1, 20);
  groups: IPagedGroup = {
    items: [],
    totalCount: 0
  };
  loadGroups(query?: string) {
    this.groupFilter.name = query || '';

    this.isGroupsLoading = true;
    this.groupService.getList(this.groupFilter)
    .pipe(finalize(() => this.isGroupsLoading = false))
      .subscribe({
        next: groups => this.groups = groups,
        error: () => this.message.error($localize`:@@iam.teams.failed-to-load-groups:Failed to load groups`)
      });
  }

  isAddingUser: boolean = false;
  doSubmit() {
    const { email, permissions } = this.form.value;
    const payload = {
      email,
      policyIds: permissions.policyId ? [permissions.policyId] : [],
      groupIds: permissions.groupId ? [permissions.groupId] : []
    }

    this.isAddingUser = true;
    this.organizationService.addUser(payload)
    .pipe(finalize(() => this.isAddingUser = false))
    .subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.close.emit(true);
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  onClose() {
    this.close.emit(false);
  }
}
