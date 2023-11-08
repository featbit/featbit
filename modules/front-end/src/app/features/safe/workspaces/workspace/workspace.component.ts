import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard, getAuth } from '@utils/index';
import { IWorkspace, License, LicenseFeatureEnum } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { getCurrentWorkspace } from "@utils/project-env";
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

  licenseForm!: FormGroup;

  auth = getAuth();
  workspace: IWorkspace;

  license: License;

  isNameKeyLoading: boolean = false;
  isLicenseLoading: boolean = false;

  constructor(
    private messageQueueService: MessageQueueService,
    private organizationService: OrganizationService,
    private workspaceService: WorkspaceService,
    private message: NzMessageService
  ) { }

  async ngOnInit() {
    this.isLoading = true;
    const workspace = await this.workspaceService.getWorkspace();
    this.workspace = workspace;
    this.license = new License(workspace.license);
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

    this.licenseForm = new FormGroup({
      license: new FormControl(this.workspace.license, [Validators.required]),
    });
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  submitNameKeyForm() {
    if (this.nameKeyForm.invalid) {
      for (const i in this.nameKeyForm.controls) {
        this.nameKeyForm.controls[i].markAsDirty();
        this.nameKeyForm.controls[i].updateValueAndValidity();
      }
      return;
    }
    const { name, key } = this.nameKeyForm.value;
    const { id} = this.workspace;

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

  submitLicenseForm() {
    if (this.licenseForm.invalid) {
      for (const i in this.licenseForm.controls) {
        this.licenseForm.controls[i].markAsDirty();
        this.licenseForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { license } = this.licenseForm.value;

    this.isLicenseLoading = true;
    this.workspaceService.updateLicense(license)
      .subscribe({
        next: (workspace) => {
          this.isLicenseLoading = false;
          this.workspace = workspace;
          this.license = new License(workspace.license);
          this.message.success($localize`:@@org.org.license-update-success:License updated!`);
          this.workspaceService.setWorkspace(workspace);
          this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
        },
        error: () => {
          this.message.error($localize`:@@org.org.invalid-license:Invalid license, please contact FeatBit team to get a license!`);
          this.isLicenseLoading = false;
        }
      });
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
}
