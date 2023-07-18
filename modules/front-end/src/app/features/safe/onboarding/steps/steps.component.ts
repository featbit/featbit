import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {OrganizationService} from "@services/organization.service";
import { GET_STARTED } from "@utils/localstorage-keys";
import { getCurrentOrganization } from "@utils/project-env";
import { slugify } from "@utils/index";

@Component({
  selector: 'init-steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent implements OnDestroy {

  private destroy$: Subject<void> = new Subject();
  currentStep = 0;
  currentOrganizationId: string;
  step0Form: FormGroup;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private msg: NzMessageService,
    private fb: FormBuilder
  ) {

    this.step0Form = this.fb.group({
      organizationName: ['', [Validators.required]],
      projectName: ['', [Validators.required]]
    });

    const organization = getCurrentOrganization();
    this.currentOrganizationId = organization.id;
    this.step0Form.patchValue({
      organizationName: organization.name
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  pre(): void {
    this.currentStep -= 1;
  }

  next(): void {
    this.currentStep += 1;
  }

  done(): void {
    const { organizationName, projectName } = this.step0Form.value;
    const payload = {
      organizationName,
      projectName,
      projectKey: slugify(projectName),
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
