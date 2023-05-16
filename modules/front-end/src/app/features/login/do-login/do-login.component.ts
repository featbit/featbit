import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import {IdentityService} from "@services/identity.service";

@Component({
  selector: 'app-do-login',
  templateUrl: './do-login.component.html',
  styleUrls: ['./do-login.component.less', '../login.component.less']
})
export class DoLoginComponent implements OnInit {

  pwdLoginForm: FormGroup;
  passwordVisible: boolean = false;
  isLogin: boolean = false;

  constructor(
    private fb: FormBuilder,
    private identityService: IdentityService,
    private router: Router,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.pwdLoginForm = this.fb.group({
      identity: ['', [Validators.required, phoneNumberOrEmailValidator]],
      password: ['', [Validators.required]]
    });
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

    const {identity, password} = this.pwdLoginForm.value;
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
}
