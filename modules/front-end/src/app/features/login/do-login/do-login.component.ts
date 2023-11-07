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
  Email = 'email',
  Workspace = 'workspace',
  Password = 'password'
}

@Component({
  selector: 'app-do-login',
  templateUrl: './do-login.component.html',
  styleUrls: ['./do-login.component.less', '../login.component.less']
})
export class DoLoginComponent implements OnInit {

  step: LoginStep = LoginStep.Email;
  pwdLoginForm: FormGroup;
  passwordVisible: boolean = false;
  isLoading: boolean = false;

  isSsoEnabled: boolean = false;
  isSpinning: boolean = false;
  ssoAuthorizeUrl: string;

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
      password: ['', [this.requiredWhenLoginVerifiedValidator(LoginStep.Password)]],
      workspaceKey: ['', [this.requiredWhenLoginVerifiedValidator(LoginStep.Workspace)]]
    });

    this.isSsoEnabled = await this.ssoService.isEnabled();
    this.ssoAuthorizeUrl = this.ssoService.authorizeUrl;
    this.subscribeSsoLogin();
  }

  requiredWhenLoginVerifiedValidator = (step: LoginStep): ValidatorFn => {
    return (control: AbstractControl) => {
      let currentControl: AbstractControl = null;

      switch (step) {
        case LoginStep.Workspace:
          currentControl = control.parent?.controls['workspaceKey'];
          break;
        case LoginStep.Password:
          currentControl = control.parent?.controls['password'];
          break;
      }

      if (step === this.step && currentControl && (!currentControl.value || currentControl.value.length === 0)) {
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
        this.step = response ? LoginStep.Workspace : LoginStep.Password;
        this.isLoading = false;
      },
      error: error => this.handleError(error)
    });
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
      case LoginStep.Email:
        this.isLoading = true;
        this.hasMultipleWorkspaces(identity);
        break;
      case LoginStep.Workspace:
        this.step = LoginStep.Password;
        break;
      case LoginStep.Password:
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
        this.isSpinning = true;

        this.ssoService.oidcLogin(params['code'])
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
