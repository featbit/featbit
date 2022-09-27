import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { getAuth } from '@utils/index';
import { IOrganization } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import {PermissionsService} from "@services/permissions.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.less']
})
export class AccountComponent implements OnInit {

  creatOrganizationFormVisible: boolean = false;

  validateOrgForm!: FormGroup;

  auth = getAuth();
  currentOrganization: IOrganization;
  allOrganizations: IOrganization[];

  canUpdateOrgName: boolean = false;

  isLoading: boolean = false;

  constructor(
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) {
  }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.canTakeAction(generalResourceRNPattern.account, permissionActions.UpdateOrgName);
    this.allOrganizations = this.organizationService.organizations;

    const currentOrganizationId = getCurrentOrganization().id;
    this.currentOrganization = this.allOrganizations.find(x => x.id == currentOrganizationId);

    this.initOrgForm();
  }

  initOrgForm() {
    this.validateOrgForm = new FormGroup({
      organizationName: new FormControl(this.currentOrganization.name, [Validators.required]),
    });
  }

  onCreateAccountClick() {
    this.creatOrganizationFormVisible = true;
  }

  onCreateAccountClosed(account: IOrganization) {
    this.creatOrganizationFormVisible = false;
    if (account) {
      this.organizationService.organizations = [...this.organizationService.organizations, account];
      this.organizationService.switchOrganization(account);
    }
  }

  onAccountChange() {
    this.organizationService.switchOrganization(this.currentOrganization);
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
    const { organizationName } = this.validateOrgForm.value;
    const { id, initialized } = this.currentOrganization;

    this.isLoading = true;
    this.organizationService.updateOrganization({ organizationName, id })
      .pipe()
      .subscribe(
        () => {
          this.isLoading = false;
          this.message.success($localize `:@@org.org.orgNameUpdateSuccess:Organization name updated!`);
          this.organizationService.setOrganization({ id, initialized, name: organizationName });
        },
        () => {
          this.isLoading = false;
        }
      );
  }

}
