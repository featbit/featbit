import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IWorkspace, License, LicenseFeatureEnum } from '@shared/types';
import { WorkspaceService } from "@services/workspace.service";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";

@Component({
    selector: 'workspace',
    templateUrl: './workspace.component.html',
    styleUrls: ['./workspace.component.less'],
    standalone: false
})
export class WorkspaceComponent implements OnInit {

  isLoading: boolean = false;
  nameKeyForm: FormGroup;
  ssoForm!: FormGroup;

  canUpdateGeneralSettings: boolean = false;
  canUpdateSSOSettings: boolean = false;

  isSsoGranted: boolean = false;

  workspace: IWorkspace;

  license: License;

  isNameKeyLoading: boolean = false;
  isSsoLoading: boolean = false;

  constructor(
    private workspaceService: WorkspaceService,
    private permissionsService: PermissionsService,
    private message: NzMessageService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    const workspace = await this.workspaceService.getWorkspace();
    this.workspace = workspace;
    this.license = new License(workspace.license);
    this.isSsoGranted = this.license.isGranted(LicenseFeatureEnum.Sso);

    this.canUpdateGeneralSettings = this.permissionsService.isGranted(generalResourceRNPattern.workspace, permissionActions.UpdateWorkspaceGeneralSettings);
    this.canUpdateSSOSettings = this.permissionsService.isGranted(generalResourceRNPattern.workspace, permissionActions.UpdateWorkspaceSSOSettings);

    this.initForm();
    this.isLoading = false;
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.workspaceService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  initForm() {
    this.nameKeyForm = new FormGroup({
      name: new FormControl(this.workspace.name, [Validators.required]),
      key: new FormControl(this.workspace.key, Validators.required, this.keyAsyncValidator)
    });

    if (this.isSsoGranted) {
      this.ssoForm = new FormGroup({
        clientId: new FormControl(this.workspace.sso?.oidc?.clientId, [Validators.required]),
        clientSecret: new FormControl(this.workspace.sso?.oidc?.clientSecret, [Validators.required]),
        tokenEndpoint: new FormControl(this.workspace.sso?.oidc?.tokenEndpoint, [Validators.required]),
        clientAuthenticationMethod: new FormControl(this.workspace.sso?.oidc?.clientAuthenticationMethod, [Validators.required]),
        authorizationEndpoint: new FormControl(this.workspace.sso?.oidc?.authorizationEndpoint, [Validators.required]),
        scope: new FormControl(this.workspace.sso?.oidc?.scope, [Validators.required]),
        userEmailClaim: new FormControl(this.workspace.sso?.oidc?.userEmailClaim, [Validators.required]),
      });
    }
  }

  updateWorkspace() {
    if (!this.nameKeyForm.valid) {
      for (const i in this.nameKeyForm.controls) {
        this.nameKeyForm.controls[i].markAsDirty();
        this.nameKeyForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { name, key } = this.nameKeyForm.value;
    const { id } = this.workspace;

    this.isNameKeyLoading = true;
    this.workspaceService.update(id, name, key)
      .subscribe({
        next: (workspace) => {
          this.workspace = workspace;
          this.isNameKeyLoading = false;
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
          this.workspaceService.setWorkspace(workspace);
        },
        error: () => this.isNameKeyLoading = false
      });
  }

  updateOidcSetting() {
    if (!this.ssoForm.valid) {
      for (const i in this.ssoForm.controls) {
        this.ssoForm.controls[i].markAsDirty();
        this.ssoForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const payload = {
      ...this.ssoForm.value,
      id: this.workspace.id
    };

    this.isSsoLoading = true;
    this.workspaceService.updateOidcSetting(payload)
      .subscribe({
        next: (workspace) => {
          this.workspace = workspace;
          this.isSsoLoading = false;
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
          this.workspaceService.setWorkspace(workspace);
        },
        error: () => this.isSsoLoading = false
      });
  }
}
