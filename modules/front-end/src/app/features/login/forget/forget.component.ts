import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { phoneNumberOrEmailValidator } from "@utils/form-validators";
import { UserService } from "@services/user.service";

@Component({
  selector: 'app-forget',
  templateUrl: './forget.component.html',
  styleUrls: ['./forget.component.less', '../login.component.less']
})
export class ForgetComponent implements OnInit {

  isResetting: boolean = false;
  resetForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.resetForm = this.fb.group({
      identity: ['', [Validators.required, phoneNumberOrEmailValidator]],
      code: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(5)]]
    })
  }

  login() {
    this.router.navigateByUrl('/login');
  }

  passwordVisible: boolean = false;

  isSendingCode: boolean = false;
  getCodeInterval: number = 0;
  sendIdentityCode() {
    this.resetForm.get('code').reset();

    let identity = this.resetForm.get('identity');
    if (identity.invalid) {
      identity.markAsDirty();
      identity.updateValueAndValidity();
      return;
    }
    this.isSendingCode = true;

    this.userService.sendIdentityCode(identity.value, 'forget-password').subscribe(
      (response: any) => {
        this.isSendingCode = false;

        if (response.success) {
          this.message.success('验证码已发送, 请注意查收');

          this.getCodeInterval = 60;
          const codeInterval = setInterval(() => {
            if (this.getCodeInterval === 0) {
              clearInterval(codeInterval);
              return;
            }

            this.getCodeInterval--;
          }, 1000);
        } else {
          this.message.error(response.message);
        }
      },
      _ => {
        this.isSendingCode = false;
        this.message.error('发送验证码失败, 请联系运营人员');
      }
    );
  }

  resetPwd() {
    if (this.resetForm.invalid) {
      Object.values(this.resetForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    this.isResetting = true;

    const {identity, code, newPassword} = this.resetForm.value;
    this.userService.resetPassword(identity, code, newPassword).subscribe(
      response => this.handleResponse(response),
      err => this.handleError(err)
    );
  }

  handleResponse(response) {
    this.isResetting = false;

    if (response.success) {
      this.message.success('密码重置成功, 请重新登录');
      this.login();
    } else {
      this.message.error(response.message);
    }
  }

  handleError(error) {
    this.isResetting = false;

    this.message.error(error.error.message);
  }
}
