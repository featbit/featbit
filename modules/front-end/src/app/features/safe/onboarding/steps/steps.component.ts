import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { OrganizationService } from "@services/organization.service";
import { GET_STARTED } from "@utils/localstorage-keys";
import { getCurrentOrganization } from "@utils/project-env";
import { slugify } from "@utils/index";
import { IOrganizationPermissions } from "@shared/types";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { ProjectService } from "@services/project.service";

@Component({
  selector: 'init-steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent implements OnInit {

  currentStep = 0;
  currentOrganizationId: string;
  organizationPermission: IOrganizationPermissions;
  form: FormGroup;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private projectService: ProjectService,
    private msg: NzMessageService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.form = this.fb.group({
      organizationName: ['', [Validators.required]],
      organizationKey: [ '', [Validators.required], [this.orgKeyAsyncValidator]],
      projectName: ['', [Validators.required]],
      projectKey: ['', [Validators.required], [this.projectKeyAsyncValidator]]
    });

    const organization = getCurrentOrganization();
    this.currentOrganizationId = organization.id;
    this.organizationPermission = organization.defaultPermissions;
    this.form.patchValue({
      organizationName: organization.name,
      organizationKey: organization.key
    });

    this.form.get('projectName').valueChanges.subscribe(value => {
      this.nameChange(value, 'projectKey');
    });

    this.form.get('organizationName').valueChanges.subscribe(value => {
      this.nameChange(value, 'organizationKey');
    });
  }

  nameChange(name: string, controlName: string) {
    let keyControl = this.form.get(controlName)!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  orgKeyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.organizationService.isKeyUsed(value as string)),
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

  projectKeyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.projectService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
        case true:
          return {error: true, duplicated: true};
        case undefined:
          return {error: true, unknown: true};
        default:
          return null;
      }
    }),
    first()
  );

  done(): void {
    const { organizationName, projectKey, projectName } = this.form.value;
    const organizationKey = slugify(organizationName);
    const payload = {
      organizationName,
      projectName,
      projectKey,
      organizationKey,
      environments: ['Dev', 'Prod']
    };

    this.organizationService.onboarding(payload).subscribe({
      next: () => {
        this.organizationService.setOrganization({
          id: this.currentOrganizationId,
          initialized: true,
          name: organizationName,
          key: organizationKey,
          defaultPermissions: this.organizationPermission
        });

        if (!localStorage.getItem(GET_STARTED())) {
          this.router.navigateByUrl('/get-started?status=init');
          return;
        }

        this.router.navigateByUrl(`/feature-flags?status=init`);
      },
      error: () => this.msg.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
    });
  }
}
