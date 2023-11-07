import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import {IdentityService} from "@services/identity.service";
import { SsoService } from "@services/sso.service";
import { ActivatedRoute } from "@angular/router";
import { finalize } from "rxjs/operators";
import { WorkspaceService } from "@services/workspace.service";

enum LoginStep {
  Step1 = 'step1', // email
  Step2 = 'step2' // workspace and (or) password
}

@Component({
  selector: 'app-do-login',
  templateUrl: './do-login.component.html',
  styleUrls: ['./do-login.component.less', '../login.component.less']
})
export class DoLoginComponent implements OnInit {

  isSSO: boolean = false;
  step: LoginStep = LoginStep.Step1;
  displayWorkspaceKey: boolean = false;
  pwdLoginForm: FormGroup;
  ssoForm: FormGroup;
  passwordVisible: boolean = false;
  isLoading: boolean = false;

  isSsoEnabled: boolean = false;
  isSpinning: boolean = false;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private identityService: IdentityService,
    private ssoService: SsoService,
    private message: NzMessageService,
    private workspaceService: WorkspaceService
  ) { }

  async ngOnInit() {
    this.pwdLoginForm = this.fb.group({
      identity: ['', [Validators.required, phoneNumberOrEmailValidator]],
      password: ['', [this.requiredWhenLoginVerifiedValidator(LoginStep.Step2)]],
      workspaceKey: ['', [this.requiredWhenLoginVerifiedValidator(LoginStep.Step2)]]
    });

    this.ssoForm = this.fb.group({
      workspaceKey: ['', [this.requiredWhenLoginVerifiedValidator(LoginStep.Step2)]]
    });

    this.isSsoEnabled = await this.ssoService.isEnabled();
    this.subscribeSsoLogin();
  }

  requiredWhenLoginVerifiedValidator = (step: LoginStep): ValidatorFn => {
    return (control: AbstractControl) => {

      if (step === this.step && (!control.value || control.value.length === 0)) {
        const error = { required: true };
        control.setErrors(error);
        return error;
      } else {
        control.setErrors(null);
      }

      return null;
    };
  }

  hasMultipleWorkspaces(identity: string) {
    this.workspaceService.hasMultipleWorkspaces(identity).subscribe({
      next: response => {
        this.displayWorkspaceKey = response;
        this.step = LoginStep.Step2;
        this.isLoading = false;
      },
      error: error => this.handleError(error)
    });
  }

  ssoLogin() {
    if (this.ssoForm.invalid) {
      Object.values(this.ssoForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    const { workspaceKey } = this.ssoForm.value;

    window.location.href = this.ssoService.getAuthorizeUrl(workspaceKey);
  }

  async passwordLogin() {
    if (this.pwdLoginForm.invalid) {
      Object.values(this.pwdLoginForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    const { identity, password, workspaceKey } = this.pwdLoginForm.value;

    switch (this.step) {
      case LoginStep.Step1:
        this.isLoading = true;
        this.hasMultipleWorkspaces(identity);
        break;
      case LoginStep.Step2:
        this.isLoading = true;
        this.identityService.loginByEmail(identity, password, workspaceKey).subscribe({
          next: response => this.handleResponse(response),
          error: error => this.handleError(error)
        });
        break;
    }
  }

  async handleResponse(response) {
    this.isLoading = false;

    if (!response.success) {
      this.message.error($localize `:@@common.incorrect-email-or-password:Email and/or password incorrect` );
      return;
    }

    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize `:@@common.login-success:Login with success`);
  }

  handleError(_) {
    this.isLoading = false;

    this.message.error($localize `:@@common.login-error:Error occurred, please contact the support.`);
  }

  subscribeSsoLogin() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params["sso-logged-in"] && params['code']) {
        this.isSSO = true;
        this.isSpinning = true;

        this.ssoService.oidcLogin(params['code'], params['workspace_key'])
          .pipe(finalize(() => this.isSpinning = false))
          .subscribe({
            next: response => this.handleSsoResponse(response),
            error: error => this.handleError(error)
          })
      }
    });
  }

  async handleSsoResponse(response) {
    if (!response.success) {
      if (response.errors) {
        this.message.error(response.errors[0]);
      } else {
        this.message.error($localize`:@@common.cannot-login-by-oidc-code:Failed to login by OpenID Connect SSO.`);
      }

      return;
    }

    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize`:@@common.login-success:Login with success`);
  }

  protected readonly LoginStep = LoginStep;
}
