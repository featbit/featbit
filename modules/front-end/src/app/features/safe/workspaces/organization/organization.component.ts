import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IOrganization, License, LicenseFeatureEnum } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentLicense, getCurrentOrganization } from "@utils/project-env";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { MessageQueueService } from '@core/services/message-queue.service';
import { IPagedPolicy, PolicyFilter } from "@features/safe/iam/types/policy";
import { GroupListFilter, IPagedGroup } from "@features/safe/iam/types/group";
import { PolicyService } from "@services/policy.service";
import { GroupService } from "@services/group.service";

@Component({
  selector: 'organization',
  templateUrl: './organization.component.html',
  styleUrls: ['./organization.component.less']
})
export class OrganizationComponent implements OnInit {

  creatOrganizationFormVisible: boolean = false;

  organizationForm!: FormGroup;
  defaultPermissionsForm!: FormGroup;

  currentOrganization: IOrganization;
  allOrganizations: IOrganization[];

  canUpdateOrgName: boolean = false;

  license: License;

  isLoading: boolean = false;
  isDefaultPermissionsLoading: boolean = false;

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

  constructor(
    private messageQueueService: MessageQueueService,
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private permissionsService: PermissionsService,
    private policyService: PolicyService,
    private groupService: GroupService
  ) {
    this.getPolicies();
    this.getGroups();
  }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.UpdateOrgName);
    this.allOrganizations = this.organizationService.organizations;

    const currentOrganizationId = getCurrentOrganization().id;
    this.currentOrganization = this.allOrganizations.find(x => x.id == currentOrganizationId);
    this.license = getCurrentLicense();

    this.organizationForm = new FormGroup({
      name: new FormControl(this.currentOrganization.name, [ Validators.required ]),
    });

    this.defaultPermissionsForm = new FormGroup(
      {
        policyId: new FormControl(this.currentOrganization.defaultPermissions.policyIds?.[0], []),
        groupId: new FormControl(this.currentOrganization.defaultPermissions.groupIds?.[0], []),
      },
      { validators: this.permissionsValidator }
    );
  }

  getPolicies(query?: string) {
    this.policyFilter.name = query || '';

    this.isPoliciesLoading = true;
    this.policyService.getList(this.policyFilter).subscribe({
      next: policies => {
        this.policies = policies;
        this.isPoliciesLoading = false;
      },
      error: () => this.isPoliciesLoading = false
    });
  }

  getGroups(query?: string) {
    this.groupFilter.name = query || '';

    this.isGroupsLoading = true;
    this.groupService.getList(this.groupFilter).subscribe({
      next: groups => {
        this.groups = groups;
        this.isGroupsLoading = false;
      },
      error: () => this.isGroupsLoading = false
    });
  }

  permissionsValidator(form: FormGroup) {
    if (!form.touched) {
      return null; // Skip validation if the form hasn't been interacted with
    }

    const policy = form.get('policyId')?.value;
    const group = form.get('groupId')?.value;

    if (policy.length === 0 && group.length === 0) {
      return { empty: true }; // Return an error object
    }
    return null; // No errors
  }

  updateDefaultPermissions() {
    if (!this.defaultPermissionsForm.valid) {
      for (const i in this.defaultPermissionsForm.controls) {
        this.defaultPermissionsForm.controls[i].markAsDirty();
        this.defaultPermissionsForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { policyId, groupId } = this.defaultPermissionsForm.value;

    const defaultPermissions = {
      policyIds: policyId ? [ policyId ] : [],
      groupIds: groupId ? [ groupId ] : [],
    }

    const { id, initialized, name, key } = this.currentOrganization;

    this.isDefaultPermissionsLoading = true;
    this.organizationService.update({ name, defaultPermissions })
    .subscribe({
      next: () => {
        this.isDefaultPermissionsLoading = false;
        this.message.success($localize`:@@org.org.orgDefaultPermissionsUpdateSuccess:Default permissions updated!`);
        this.organizationService.setOrganization({ id, initialized, name, key, defaultPermissions });
        this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
      },
      error: () => {
        this.message.error($localize`:@@common.operation-failed:Operation failed`);
        this.isDefaultPermissionsLoading = false;
      }
    });
  }

  onCreateOrganizationClick() {
    this.creatOrganizationFormVisible = true;
  }

  onCreateOrganizationClosed(organization: IOrganization) {
    this.creatOrganizationFormVisible = false;
    if (organization) {
      this.organizationService.organizations = [...this.organizationService.organizations, organization];
      this.organizationService.switchOrganization(organization);
      window.location.reload();
    }
  }

  onOrganizationChange() {
    this.organizationService.switchOrganization(this.currentOrganization);
    window.location.reload();
  }

  updateOrganizationName() {
    if (!this.canUpdateOrgName) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.organizationForm.invalid) {
      for (const i in this.organizationForm.controls) {
        this.organizationForm.controls[i].markAsDirty();
        this.organizationForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { name } = this.organizationForm.value;
    const { id, initialized, key, defaultPermissions} = this.currentOrganization;

    this.isLoading = true;
    this.organizationService.update({ name, defaultPermissions })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.message.success($localize`:@@org.org.orgNameUpdateSuccess:Organization name updated!`);
          this.organizationService.setOrganization({ id, initialized, name, key, defaultPermissions });
          this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
        },
        error: () => {
          this.message.error($localize`:@@common.operation-failed:Operation failed`);
          this.isLoading = false;
        }
      });
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
}
