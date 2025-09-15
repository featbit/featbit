import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {debounceTime, first, map, switchMap} from "rxjs/operators";
import { GroupService } from "@services/group.service";

@Component({
    selector: 'group-drawer',
    templateUrl: './group-drawer.component.html',
    styleUrls: ['./group-drawer.component.less'],
    standalone: false
})
export class GroupDrawerComponent implements OnInit {

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
    private groupService: GroupService
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
    switchMap(value => this.groupService.isNameUsed(value as string)),
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

  isSubmitting: boolean = false;
  doSubmit() {
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isSubmitting = true;
    const {name, description} = this.form.value;
    this.groupService.create(name, description).subscribe(
      () => {
        this.isSubmitting = false;
        this.close.emit(true);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.form.reset();
      },
      _ => {
        this.isSubmitting = false;
      }
    )
  }
}
