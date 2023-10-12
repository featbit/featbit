import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard, getAuth } from '@utils/index';
import { IOrganization } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentOrganization } from "@utils/project-env";
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
  validateLicenseForm!: FormGroup;

  auth = getAuth();
  currentOrganization: IOrganization;
  allOrganizations: IOrganization[];

  canUpdateOrgName: boolean = false;

  isLoading: boolean = false;
  isLicenseLoading: boolean = false;

  constructor(
    private messageQueueService: MessageQueueService,
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) { }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.isGranted(generalResourceRNPattern.account, permissionActions.UpdateOrgName);
    this.allOrganizations = this.organizationService.organizations;

    const currentOrganizationId = getCurrentOrganization().id;
    this.currentOrganization = this.allOrganizations.find(x => x.id == currentOrganizationId);

    this.initOrgForm();
  }

  initOrgForm() {
    this.validateOrgForm = new FormGroup({
      name: new FormControl(this.currentOrganization.name, [Validators.required]),
    });

    this.validateLicenseForm = new FormGroup({
      license: new FormControl(this.currentOrganization.license, [Validators.required]),
    });
  }

  onCreateAccountClick() {
    this.creatOrganizationFormVisible = true;
  }

  onCreateAccountClosed(organization: IOrganization) {
    this.creatOrganizationFormVisible = false;
    if (organization) {
      this.organizationService.organizations = [...this.organizationService.organizations, organization];
      this.organizationService.switchOrganization(organization);
    }
  }

  onAccountChange() {
    this.organizationService.switchOrganization(this.currentOrganization);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
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
    const { id, initialized, license} = this.currentOrganization;

    this.isLoading = true;
    this.organizationService.update({ name })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.message.success($localize`:@@org.org.orgNameUpdateSuccess:Organization name updated!`);
          this.organizationService.setOrganization({ id, initialized, name, license });
          this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
        },
        error: () => this.isLoading = false
      });
  }

  submitLicenseForm() {
    if (this.validateLicenseForm.invalid) {
      for (const i in this.validateLicenseForm.controls) {
        this.validateLicenseForm.controls[i].markAsDirty();
        this.validateLicenseForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { license } = this.validateLicenseForm.value;
    const { id, initialized, name} = this.currentOrganization;

    this.isLicenseLoading = true;
    this.organizationService.updateLicense(license)
      .subscribe({
        next: () => {
          this.isLicenseLoading = false;
          this.message.success($localize`:@@org.org.license-update-success:License updated!`);
          this.organizationService.setOrganization({ id, initialized, name, license });
          this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
        },
        error: () => {
          this.message.error($localize`:@@org.org.invalid-license:Invalid license, please contact FeatBit team to get a license!`);
          this.isLicenseLoading = false;
        }
      });
  }
}
