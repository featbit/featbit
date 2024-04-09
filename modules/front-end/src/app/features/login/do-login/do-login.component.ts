import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import { IdentityService } from "@services/identity.service";
import { SsoService } from "@services/sso.service";
import { ActivatedRoute } from "@angular/router";
import { IS_SSO_FIRST_LOGIN } from "@utils/localstorage-keys";
import { UserService } from "@services/user.service";
import { SocialService } from "@services/social.service";
import { OAuthProvider, OAuthProviderEnum } from "@shared/types";

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

  isSocialEnabled: boolean = false;
  oauthProviders: OAuthProvider[] = [];

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private identityService: IdentityService,
    private ssoService: SsoService,
    private socialService: SocialService,
    private message: NzMessageService,
    private userService: UserService
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

    const [providers, ssoEnabled] = await Promise.all([this.socialService.getProviders(), this.ssoService.isEnabled()]);

    this.oauthProviders = providers;
    this.isSsoEnabled = ssoEnabled;
    this.isSocialEnabled = this.oauthProviders.length > 0;
    this.subscribeExternalLogin();
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
    this.userService.hasMultipleWorkspaces(identity).subscribe({
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

  socialLogin(provider: OAuthProvider) {
    window.location.href = provider.authorizeUrl;
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
    this.isSpinning = false;

    this.message.error($localize `:@@common.login-error:Error occurred, please contact the support.`);
  }

  subscribeExternalLogin() {
    this.activatedRoute.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];

      if (code && state) {
        this.isSpinning = true;

        const observer = {
          next: response => this.handleExternalLoginResponse(response),
          error: error => this.handleError(error),
          complete: () => this.isSpinning = false
        };

        if (params["sso-logged-in"]) {
          this.isSSO = true;
          this.ssoService.oidcLogin(code, state).subscribe(observer);
        } else if (params["social-logged-in"]) {
          this.socialService.login(code, state).subscribe(observer);
        } else {
          this.isSpinning = false;
        }
      }
    });
  }

  async handleExternalLoginResponse(response) {
    if (!response.success) {
      if (response.errors) {
        this.message.error(response.errors[0]);
      } else {
        this.message.error($localize`:@@common.cannot-login-by-code:Failed to login.`);
      }

      return;
    }

    localStorage.setItem(IS_SSO_FIRST_LOGIN, response.data.isSsoFirstLogin);
    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize`:@@common.login-success:Login with success`);
  }

  protected readonly LoginStep = LoginStep;
  protected readonly OAuthProviderEnum = OAuthProviderEnum;
}
