import { Component, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {OrganizationService} from "@services/organization.service";
import { ISecret } from "@shared/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent implements OnDestroy {

  flag: IFeatureFlag;

  private destroy$: Subject<void> = new Subject();

  @Input() secret: ISecret;

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

  onStepChange(step: number): void {
    this.currentStep = step;
  }

  onStep0Complete(flag: IFeatureFlag) {
    this.flag = { ...flag };
    this.onStepChange(this.currentStep + 1);
  }

  done() {
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
