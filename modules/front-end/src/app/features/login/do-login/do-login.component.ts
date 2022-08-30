import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import { UserService } from "@services/user.service";

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
    private userService: UserService,
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
    this.userService.loginByPassword(identity, password).subscribe(
      response => this.handleResponse(response),
      error => this.handleError(error)
    )
  }

  async handleResponse(response) {
    this.isLogin = false;

    if (!response.success) {
      this.message.error(response.message);
      return;
    }

    await this.userService.doLoginUser(response.token);
    this.message.success('登录成功');
  }

  handleError(_) {
    this.isLogin = false;

    this.message.error(`服务错误，请联系运营人员。`);
  }
}
