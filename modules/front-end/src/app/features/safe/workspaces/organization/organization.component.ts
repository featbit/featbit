import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IOrganization, License, LicenseFeatureEnum } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentLicense, getCurrentOrganization } from "@utils/project-env";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { MessageQueueService } from '@core/services/message-queue.service';
import { copyToClipboard } from '@utils/index';
import { IPagedPolicy, PolicyFilter } from "@features/safe/iam/types/policy";
import { GroupListFilter, IPagedGroup } from "@features/safe/iam/types/group";
import { PolicyService } from "@services/policy.service";
import { GroupService } from "@services/group.service";
import { BroadcastService } from "@services/broadcast.service";
import { FlagSortedBy, UpdateOrganizationPayload } from "@features/safe/workspaces/types/organization";

@Component({
    selector: 'organization',
    templateUrl: './organization.component.html',
    styleUrls: ['./organization.component.less'],
    standalone: false
})
export class OrganizationComponent implements OnInit {
  creatOrganizationFormVisible: boolean = false;

  organizationForm!: FormGroup;
  defaultPermissionsForm!: FormGroup;
  settingsForm!: FormGroup;

  currentOrganization: IOrganization;
  allOrganizations: IOrganization[];

  canUpdateOrgName: boolean = false;
  canCreateOrg: boolean = false;
  canUpdateDefaultPermissions: boolean = false;
  canUpdateSortFlagsBy: boolean = false;

  license: License;

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
    private groupService: GroupService,
    private broadcastService: BroadcastService
  ) {
    this.getPolicies();
    this.getGroups();
  }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.UpdateOrgName);
    this.canCreateOrg = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.CreateOrg);
    this.canUpdateDefaultPermissions = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.UpdateOrgDefaultUserPermissions);
    this.canUpdateSortFlagsBy = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.UpdateOrgSortFlagsBy);
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

    this.settingsForm = new FormGroup({
      flagSortedBy: new FormControl(this.currentOrganization.settings.flagSortedBy, [ Validators.required ]),
    });
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


  onCreateOrganizationClick() {
    this.creatOrganizationFormVisible = true;
  }

  onCreateOrganizationClosed(organization: IOrganization) {
    this.creatOrganizationFormVisible = false;
    if (organization) {
      this.organizationService.organizations = [...this.organizationService.organizations, organization];
      this.organizationService.switchOrganization(organization);
      this.broadcastService.organizationChanged();
    }
  }

  onOrganizationChange() {
    this.organizationService.switchOrganization(this.currentOrganization);
    this.broadcastService.organizationChanged();
  }

  updateOrganizationName() {
    if (!this.canUpdateOrgName) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const { name } = this.organizationForm.value;
    const { settings, defaultPermissions } = this.currentOrganization;

    this.updateOrganization({ name, settings, defaultPermissions });
  }

  updateDefaultPermissions() {
    if (!this.canUpdateDefaultPermissions) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const { policyId, groupId } = this.defaultPermissionsForm.value;

    const defaultPermissions = {
      policyIds: policyId ? [ policyId ] : [],
      groupIds: groupId ? [ groupId ] : [],
    }

    const { name, settings } = this.currentOrganization;
    this.updateOrganization({ name, settings, defaultPermissions });
  }

  updateSortFlagsBy() {
    if (!this.canUpdateSortFlagsBy) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const settings = this.settingsForm.value;
    const { name, defaultPermissions } = this.currentOrganization;

    this.updateOrganization({ name, settings, defaultPermissions });
  }

  isUpdating: boolean = false;

  private updateOrganization(payload: UpdateOrganizationPayload) {
    const { id, initialized, key } = this.currentOrganization;
    const { name, settings, defaultPermissions } = payload;

    this.isUpdating = true;
    this.organizationService.update(payload).subscribe({
      next: () => {
        this.isUpdating = false;
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.organizationService.setOrganization({ id, initialized, name, key, settings, defaultPermissions });
        this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
      },
      error: () => {
        this.message.error($localize`:@@common.operation-failed:Operation failed`);
        this.isUpdating = false;
      }
    });
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
  protected readonly flagSortedBy = FlagSortedBy;
}
