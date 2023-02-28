import {Component, EventEmitter, Input, OnChanges, Output} from "@angular/core";
import {ICategory, IRefType} from "@shared/diff/types";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {RefTypeEnum} from "@core/components/audit-log/types";
import {DiffFactoryService} from "@services/diff-factory.service";

@Component({
  selector: 'change-review',
  templateUrl: './change-review.component.html',
  styleUrls: ['./change-review.component.less']
})
export class ChangeReviewComponent implements OnChanges {
  @Input() visible = false;
  @Input() refName: string = '';
  @Input() previous: string = '{}';
  @Input() current: string = '{}';
  @Input() refType: RefTypeEnum;
  @Input() refs: IRefType;
  @Output() onSave = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<any>();

  numChanges = 0;
  changeCategories: ICategory[] = [];
  reviewForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private diffFactoryService: DiffFactoryService,
  ) {
  }

  ngOnChanges() {
    if (this.visible) {
      this.changeCategories = this.diffFactoryService.getDiffer(this.refType).diff(this.previous, this.current, this.refs);
      this.numChanges = this.changeCategories.flatMap((category) => category.changes).length;

      this.reviewForm = this.fb.group({
        comment: ['', []]
      });
    }
  }

  onValidate() {
    if (this.reviewForm.invalid) {
      Object.values(this.reviewForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    this.onSave.emit(this.reviewForm.value);
  }

  closeModal() {
    this.onCancel.emit();
  }
}
