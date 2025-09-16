import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { WorkspaceService } from "@services/workspace.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { IWorkspace, License } from "@shared/types";
import { getCurrentWorkspace } from "@utils/project-env";
import { copyToClipboard } from "@utils/index";


@Component({
  selector: 'license',
  standalone: false,
  templateUrl: './license.component.html',
  styleUrl: './license.component.less'
})
export class LicenseComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private messageService = inject(NzMessageService);

  workspace: IWorkspace;
  license: License;

  form: FormGroup;

  ngOnInit(): void {
    this.workspace = getCurrentWorkspace();
    this.license = new License(this.workspace.license);
    this.form = new FormGroup({
      workspaceId: new FormControl({
        value: this.workspace.id,
        disabled: true
      }),
      license: new FormControl(this.workspace.license, [ Validators.required ]),
    });
  }

  updating: boolean = false;
  updateLicense() {
    if (!this.form.valid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
      return;
    }

    const { license } = this.form.value;

    this.updating = true;
    this.workspaceService.updateLicense(license).subscribe({
      next: (workspace) => {
        this.updating = false;

        this.workspaceService.setWorkspace(workspace);
        this.messageService.success($localize`:@@org.org.license-update-success:License updated!`);

        // reload page to apply new license
        location.reload();
      },
      error: () => {
        this.messageService.error($localize`:@@org.org.invalid-license:Invalid license, please contact FeatBit team to get a license!`);
        this.updating = false;
      }
    });
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.messageService.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
