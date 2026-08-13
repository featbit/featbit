import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { ChangeCommentData, OperationDescriptions } from "@core/components/change-comment/types";

@Component({
  selector: 'change-comment',
  templateUrl: './change-comment.component.html',
  styleUrl: './change-comment.component.less',
  standalone: false
})
export class ChangeCommentComponent {
  form: FormGroup<{
    comment: FormControl<string>,
    confirmKey: FormControl<string>
  }>;

  description: string;

  constructor(
    private fb: FormBuilder,
    private modalRef: NzModalRef,
    @Inject(NZ_MODAL_DATA) public data: ChangeCommentData
  ) {
    this.description = OperationDescriptions[data.operation].replace('{type}', data.resourceType);

    this.form = this.fb.group({
      comment: new FormControl<string>('', { nonNullable: true, validators: [ Validators.required ] }),
      confirmKey: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          this.confirmKeyValidator.bind(this),
        ]
      })
    });
  }

  confirmKeyValidator(control: AbstractControl) {
    return control.value === this.data.resourceKey ? null : { keyMismatch: true };
  }

  fillConfirmKey(): void {
    this.form.patchValue({ confirmKey: this.data.resourceKey });
  }

  confirm(): void {
    this.modalRef.close(this.form.value.comment);
  }

  cancel(): void {
    this.modalRef.close(null);
  }
}
