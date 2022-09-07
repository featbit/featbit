import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {debounceTime, first, map, switchMap} from "rxjs/operators";
import { PolicyService } from "@services/policy.service";

@Component({
  selector: 'policy-drawer',
  templateUrl: './policy-drawer.component.html',
  styleUrls: ['./policy-drawer.component.less']
})
export class PolicyDrawerComponent implements OnInit {

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private policyService: PolicyService,
    private message: NzMessageService
  ) { }

  form: FormGroup;
  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required], [this.nameAsyncValidator], 'change'],
      description: ['', []],
    });
  }

  onClose() {
    this.form.reset();
    this.close.emit();
  }

  nameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.policyService.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  isLoading: boolean = false;
  doSubmit() {
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;
    const {name, description} = this.form.value;
    this.policyService.create(name, description).subscribe(
      () => {
        this.isLoading = false;
        this.close.emit(true);
        this.message.success('添加策略成功！');
        this.form.reset();
      },
      _ => {
        this.isLoading = false;
      }
    )
  }
}
