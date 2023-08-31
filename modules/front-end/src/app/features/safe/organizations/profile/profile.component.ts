import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { getAuth } from '@utils/index';
import { UserService } from "@services/user.service";
import { IAuthProps } from "@shared/types";
import { IdentityService } from "@services/identity.service";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.less']
})
export class ProfileComponent implements OnInit {

  // profile form
  profileForm!: FormGroup;
  auth = getAuth();
  isUpdatingProfile: boolean = false;

  // reset password form
  resetPasswordForm!: FormGroup;
  isResettingPassword: boolean = false;
  confirmValidator = (control: FormControl) => {
    if (!control.value) {
      return { error: true, required: true };
    } else if (control.value !== this.resetPasswordForm.controls.newPassword.value) {
      return { error: true, confirm: true };
    }
    return {};
  };

  validateConfirmPassword(): void {
    setTimeout(() => this.resetPasswordForm.controls.confirmPassword.updateValueAndValidity());
  }

  constructor(
    private userService: UserService,
    private identityService: IdentityService,
    private message: NzMessageService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      email: [this.auth.email, [Validators.required, Validators.email]],
      name: [this.auth.name]
    });

    this.resetPasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [this.confirmValidator]]
    });

    this.resetPasswordForm.get('newPassword').valueChanges.subscribe(() => {
      this.validateConfirmPassword();
    });
  }

  updateProfile() {
    if (this.profileForm.invalid) {
      for (const control in this.profileForm.controls) {
        this.profileForm.controls[control].markAsDirty();
        this.profileForm.controls[control].updateValueAndValidity();
      }

      return;
    }

    this.isUpdatingProfile = true;

    const { email, name } = this.profileForm.value;

    this.userService.updateProfile({ email, name }).subscribe(
      (profile) => {
        this.isUpdatingProfile = false;
        this.message.success($localize`:@@org.profile.profileUpdateSuccess:Profile successfully updated`);
        this.userService.updateLocaleProfile(profile as IAuthProps);
      }
    );
  }

  resetPassword() {
    if (!this.resetPasswordForm.valid) {
      Object.values(this.resetPasswordForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    const { currentPassword, confirmPassword } = this.resetPasswordForm.value;
    this.isResettingPassword = true;
    this.identityService.resetPassword(currentPassword, confirmPassword).subscribe({
      next: (resetResult) => {
        if (resetResult.success) {
          this.message.success($localize`:@@org.profile.reset-password-success:Reset password success`);
          this.resetPasswordForm.reset();
        } else {
          let message = $localize`:@@org.profile.reset-password-failed:Reset password failed, reason: [reason].`
            .replace("[reason]", resetResult.reason);

          this.message.warning(message);
        }

        this.isResettingPassword = false;
      },
      error: () => {
        this.message.error($localize`:@@common.operation-failed:Operation failed`);
        this.isResettingPassword = false;
      }
    });
  }
}
