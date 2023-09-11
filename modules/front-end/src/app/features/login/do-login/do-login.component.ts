import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import {IdentityService} from "@services/identity.service";
import { SsoService } from "@services/sso.service";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-do-login',
  templateUrl: './do-login.component.html',
  styleUrls: ['./do-login.component.less', '../login.component.less']
})
export class DoLoginComponent implements OnInit {

  pwdLoginForm: FormGroup;
  passwordVisible: boolean = false;
  isLogin: boolean = false;

  isSsoEnabled: boolean = false;
  isSpinning: boolean = false;
  ssoAuthorizeUrl: string;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private identityService: IdentityService,
    private ssoService: SsoService,
    private message: NzMessageService
  ) { }

  async ngOnInit() {
    this.pwdLoginForm = this.fb.group({
      identity: ['', [Validators.required, phoneNumberOrEmailValidator]],
      password: ['', [Validators.required]]
    });

    this.isSsoEnabled = await this.ssoService.isEnabled();
    this.ssoAuthorizeUrl = this.ssoService.authorizeUrl;
    this.subscribeSsoLogin();
  }

  passwordLogin() {
    if (this.pwdLoginForm.invalid) {
      Object.values(this.pwdLoginForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    this.isLogin = true;

    const { identity, password } = this.pwdLoginForm.value;
    this.identityService.loginByEmail(identity, password).subscribe(
      response => this.handleResponse(response),
      error => this.handleError(error)
    )
  }

  async handleResponse(response) {
    this.isLogin = false;

    if (!response.success) {
      this.message.error($localize `:@@common.incorrect-email-or-password:Email and/or password incorrect` );
      return;
    }

    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize `:@@common.login-success:Login with success`);
  }

  handleError(_) {
    this.isLogin = false;

    this.message.error($localize `:@@common.login-error:Error occurred, please contact the support.`);
  }

  subscribeSsoLogin() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params["sso-logged-in"] && params['code']) {
        this.isSpinning = true;

        this.ssoService.oidcLogin(params['code']).subscribe({
          next: response => this.handleSsoResponse(response),
          error: error => this.handleError(error)
        })
      }
    });
  }

  async handleSsoResponse(response) {
    console.log(response);
    if (!response.success) {
      this.message.error($localize`:@@common.cannot-login-by-oidc-code:Failed to login by OpenID Connect SSO.`);
      return;
    }

    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize`:@@common.login-success:Login with success`);
  }
}
