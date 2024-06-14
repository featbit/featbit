import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard } from '@utils/index';
import { IWorkspace, License, LicenseFeatureEnum } from '@shared/types';
import { MessageQueueService } from '@core/services/message-queue.service';
import { WorkspaceService } from "@services/workspace.service";
import { debounceTime, first, map, switchMap } from "rxjs/operators";

@Component({
  selector: 'workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.less']
})
export class WorkspaceComponent implements OnInit {

  isLoading: boolean = false;
  nameKeyForm!: FormGroup;
  ssoForm!: FormGroup;
  licenseForm!: FormGroup;

  isSsoGranted: boolean = false;

  workspace: IWorkspace;

  license: License;

  isNameKeyLoading: boolean = false;
  isSsoLoading: boolean = false;
  isLicenseLoading: boolean = false;

  constructor(
    private messageQueueService: MessageQueueService,
    private workspaceService: WorkspaceService,
    private message: NzMessageService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    const workspace = await this.workspaceService.getWorkspace();
    this.workspace = workspace;
    this.license = new License(workspace.license);
    this.isSsoGranted = this.license.isGranted(LicenseFeatureEnum.Sso);
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

    this.licenseForm = new FormGroup({
      license: new FormControl(this.workspace.license, [Validators.required]),
    });
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
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

  updateLicense() {
    if (!this.licenseForm.valid) {
      for (const i in this.licenseForm.controls) {
        this.licenseForm.controls[i].markAsDirty();
        this.licenseForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { license } = this.licenseForm.value;

    this.isLicenseLoading = true;
    this.workspaceService.updateLicense(license).subscribe({
      next: (workspace) => {
        this.isLicenseLoading = false;

        this.workspaceService.setWorkspace(workspace);
        this.message.success($localize`:@@org.org.license-update-success:License updated!`);

        // reload page to apply new license
        location.reload();
      },
      error: () => {
        this.message.error($localize`:@@org.org.invalid-license:Invalid license, please contact FeatBit team to get a license!`);
        this.isLicenseLoading = false;
      }
    });
  }
}
