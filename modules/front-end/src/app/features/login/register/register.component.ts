import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { repeatPasswordValidator } from "@utils/form-validators";
import { UserService } from "src/app/services/user.service";
import { randomString } from "@utils/index";

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.less', '../login.component.less']
})
export class RegisterComponent implements OnInit {

  isRegistering: boolean = false;
  emailRegistrationForm: FormGroup;

  enableEmailRegistration: boolean = false;

  constructor(
    private router: Router,
    private userService: UserService,
    private message: NzMessageService,
    private fb: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.emailRegistrationForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(5)]],
      _password: ['', [Validators.required]]
    }, { validators: repeatPasswordValidator });
  }

  passwordVisible: boolean = false;
  login() {
    this.router.navigateByUrl('/login').then();
  }

  registerByEmail() {
    const form = this.emailRegistrationForm;

    // if invalid
    if (form.invalid) {
      Object.values(form.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({onlySelf: true});
        }
      });

      return;
    }

    this.isRegistering = true;

    const {email, _password} = this.emailRegistrationForm.value;
    this.userService.registerByEmail(email, _password).subscribe(
      response => this.handleSuccess(response),
      err => this.handleError(err)
    );
  }

  randomPwd: string = '';
  get isValidRandomPwd() {
    return !this.randomPwd || this.randomPwd.length >= 5;
  }
  newRandomPwd() {
    this.randomPwd = randomString(7);
  }

  registerByPhone(data) {
    if (!this.isValidRandomPwd) {
      return;
    }

    this.isRegistering = true;

    const {phoneNumber, code} = data;
    const pwd = this.randomPwd ? this.randomPwd : randomString(7);

    this.userService.registerByPhone(phoneNumber, code, pwd).subscribe(
      response => this.handleSuccess(response),
      err => this.handleError(err)
    );
  }

  async handleSuccess(response) {
    this.isRegistering = false;
    if (response.success) {
      await this.userService.doLoginUser(response.token);
      this.message.success('注册成功');
    } else {
      this.message.error(`注册失败: ${response.message}`);
    }
  }

  handleError(_) {
    this.isRegistering = false;
    this.message.error(`服务错误，请联系运营人员。`);
  }
}
