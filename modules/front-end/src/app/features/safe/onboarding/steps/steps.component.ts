import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { OrganizationService } from "@services/organization.service";
import { GET_STARTED } from "@utils/localstorage-keys";
import { getCurrentOrganization } from "@utils/project-env";
import { slugify } from "@utils/index";

@Component({
  selector: 'init-steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent implements OnInit {

  currentStep = 0;
  currentOrganizationId: string;
  form: FormGroup;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private msg: NzMessageService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.form = this.fb.group({
      organizationName: ['', [Validators.required]],
      projectName: ['', [Validators.required]],
      projectKey: ['', Validators.required]
    });

    this.form.get('projectName').valueChanges.subscribe(value => {
      this.form.get('projectKey').setValue(slugify(value));
    });

    const organization = getCurrentOrganization();
    this.currentOrganizationId = organization.id;
    this.form.patchValue({
      organizationName: organization.name
    });
  }

  done(): void {
    const { organizationName, projectKey, projectName } = this.form.value;
    const payload = {
      organizationName,
      projectName,
      projectKey,
      environments: ['Dev', 'Prod']
    };

    this.organizationService.onboarding(payload).subscribe({
      next: () => {
        this.organizationService.setOrganization({
          id: this.currentOrganizationId,
          initialized: true,
          name: organizationName
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
