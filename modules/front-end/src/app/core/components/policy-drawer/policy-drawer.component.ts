import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {debounceTime, first, map, switchMap} from "rxjs/operators";
import { PolicyService } from "@services/policy.service";
import { FlagKeyPattern } from "@features/safe/feature-flags/types/feature-flag";
import { slugify } from "@utils/index";

@Component({
    selector: 'policy-drawer',
    templateUrl: './policy-drawer.component.html',
    styleUrls: ['./policy-drawer.component.less'],
    standalone: false
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
      name: ['', [Validators.required], [this.nameAsyncValidator]],
      key: ['', [Validators.required], [this.keyAsyncValidator]],
      description: ['', []],
    });

    this.form.get('name').valueChanges.subscribe((event)=>{
      this.nameChange(event);
    })
  }

  onClose() {
    this.form.reset();
    this.close.emit();
  }

  nameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
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

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.policyService.isKeyUsed(value as string)),
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
    const {name, key, description} = this.form.value;
    this.policyService.create(name, key, description).subscribe({
      next: () => {
        this.isLoading = false;
        this.close.emit(true);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.form.reset();
      },
      error: _ => {
        this.isLoading = false;
      }
    })
  }
}
