import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IOrganization, License, LicenseFeatureEnum } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentLicense, getCurrentOrganization } from "@utils/project-env";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { MessageQueueService } from '@core/services/message-queue.service';

@Component({
  selector: 'organization',
  templateUrl: './organization.component.html',
  styleUrls: ['./organization.component.less']
})
export class OrganizationComponent implements OnInit {

  creatOrganizationFormVisible: boolean = false;

  validateOrgForm!: FormGroup;

  currentOrganization: IOrganization;
  allOrganizations: IOrganization[];

  canUpdateOrgName: boolean = false;

  license: License;

  isLoading: boolean = false;

  constructor(
    private messageQueueService: MessageQueueService,
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) { }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.isGranted(generalResourceRNPattern.organization, permissionActions.UpdateOrgName);
    this.allOrganizations = this.organizationService.organizations;

    const currentOrganizationId = getCurrentOrganization().id;
    this.currentOrganization = this.allOrganizations.find(x => x.id == currentOrganizationId);
    this.license = getCurrentLicense();
    this.initOrgForm();
  }

  initOrgForm() {
    this.validateOrgForm = new FormGroup({
      name: new FormControl(this.currentOrganization.name, [Validators.required]),
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

  submitOrgForm() {
    if (!this.canUpdateOrgName) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.validateOrgForm.invalid) {
      for (const i in this.validateOrgForm.controls) {
        this.validateOrgForm.controls[i].markAsDirty();
        this.validateOrgForm.controls[i].updateValueAndValidity();
      }
      return;
    }
    const { name } = this.validateOrgForm.value;
    const { id, initialized} = this.currentOrganization;

    this.isLoading = true;
    this.organizationService.update({ name })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.message.success($localize`:@@org.org.orgNameUpdateSuccess:Organization name updated!`);
          this.organizationService.setOrganization({ id, initialized, name });
          this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
        },
        error: () => this.isLoading = false
      });
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
}
