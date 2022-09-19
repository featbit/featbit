import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AccountService } from '@services/account.service';

@Component({
  selector: 'app-account-drawer',
  templateUrl: './account-drawer.component.html',
  styleUrls: ['./account-drawer.component.less']
})
export class AccountDrawerComponent implements OnInit {

  accountForm: FormGroup;

  isLoading: boolean = false;

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private accountService: AccountService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.accountForm = this.fb.group({
      organizationName: ['', [Validators.required]]
    });
  }

  onClose() {
    this.accountForm.reset();
    this.close.emit();
  }

  doSubmit() {
    if (this.accountForm.invalid) {
      for (const i in this.accountForm.controls) {
        this.accountForm.controls[i].markAsDirty();
        this.accountForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;

    const { organizationName } = this.accountForm.value;

    this.accountService.postCreateAccount({ organizationName })
      .pipe()
      .subscribe(
        res => {
          this.isLoading = false;
          this.close.emit(res);
          this.message.success($localize `:@@org.org.orgCreated:Organization successfully created!`);
        },
        _ => {
          this.isLoading = false;
        }
      );

  }
}
