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
      identity: ['test@featbit.com', [Validators.required, phoneNumberOrEmailValidator]],
      password: ['123456', [Validators.required]]
    });

    this.passwordLogin();
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
      this.message.error($localize `username and/or password incorrect` );
      return;
    }

    await this.identityService.doLoginUser(response.data.token);
    this.message.success($localize `Login with success`);
  }

  handleError(_) {
    this.isLogin = false;

    this.message.error($localize `Error occurred, please contact the support.`);
  }
}
