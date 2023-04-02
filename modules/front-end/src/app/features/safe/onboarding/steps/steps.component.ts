import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {OrganizationService} from "@services/organization.service";

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

    this.organizationService.getCurrentOrganization().subscribe(() => {
      const { organization } = this.organizationService.getCurrentOrganizationProjectEnv();
      this.currentOrganizationId = organization.id;
      this.step0Form.patchValue({
        organizationName: organization.name
      });
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
    const environments = ['Dev', 'Prod'];

    this.organizationService.onboarding({ organizationName, projectName, environments })
    .subscribe(({ flagKeyName }) => {
      this.organizationService.setOrganization({ id: this.currentOrganizationId, initialized: true, name: organizationName });
      this.router.navigateByUrl(`/feature-flags?status=init`);
    }, _ => {
      this.msg.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
    })
  }
}
