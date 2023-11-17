import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { OrganizationService } from '@services/organization.service';

@Component({
  selector: 'organization-drawer',
  templateUrl: './organization-drawer.component.html',
  styleUrls: ['./organization-drawer.component.less']
})
export class OrganizationDrawerComponent implements OnInit {

  orgForm: FormGroup;

  isLoading: boolean = false;

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private organizationService: OrganizationService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.orgForm = this.fb.group({
      name: ['', [Validators.required]]
    });
  }

  onClose() {
    this.orgForm.reset();
    this.close.emit();
  }

  doSubmit() {
    if (this.orgForm.invalid) {
      for (const i in this.orgForm.controls) {
        this.orgForm.controls[i].markAsDirty();
        this.orgForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;

    const { name } = this.orgForm.value;

    this.organizationService.create({ name })
      .pipe()
      .subscribe(
        res => {
          this.isLoading = false;
          this.close.emit(res);
          this.message.success($localize `:@@org.org.orgCreated:Organization successfully created!`);
        },
        err => {
          this.message.error(err.errors[0]);
          this.isLoading = false;
        }
      );

  }
}
