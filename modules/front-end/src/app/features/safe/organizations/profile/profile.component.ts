import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { getAuth } from '@utils/index';
import { UserService } from "@services/user.service";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.less']
})
export class ProfileComponent {

  profileForm!: FormGroup;

  auth = getAuth();

  isLoading: boolean = false;

  constructor(
    private userService: UserService,
    private message: NzMessageService,
    private fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      email: [this.auth.email ?? $localize `:@@org.profile.notProvided:Not provided`, [Validators.required, Validators.email]]
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

    this.isLoading = true;
    this.userService.updateProfile('no-value-yet')
      .subscribe(
        _ => {
          this.isLoading = false;
          this.message.success($localize `:@@org.profile.profileUpdateSuccess:Profile successfully updated`);
        },
        _ => {
          this.isLoading = false;

          this.message.warning($localize `:@@org.profile.featureUnderConstruction:This feature will be released soon!`);
        }
      );
  }
}
