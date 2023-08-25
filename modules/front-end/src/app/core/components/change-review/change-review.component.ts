import { Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";
import { ICategory, IRefType } from "@shared/diff/types";
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn } from "@angular/forms";
import { RefTypeEnum } from "@core/components/audit-log/types";
import { ChangeReviewOutput, ReviewModalKindEnum } from "@core/components/change-review/types";
import { differenceInCalendarDays, setHours, setSeconds, setMinutes } from 'date-fns';
import { DisabledTimeFn } from "ng-zorro-antd/date-picker";
import { AuditLogService } from "@services/audit-log.service";
import { IInstruction } from "@core/components/change-list-v2/instructions/types";

@Component({
  selector: 'change-review',
  templateUrl: './change-review.component.html',
  styleUrls: ['./change-review.component.less']
})
export class ChangeReviewComponent implements OnChanges {
  @Input() visible = false;
  @Input() refName: string = '';
  @Input() kind: ReviewModalKindEnum = ReviewModalKindEnum.Review;
  @Input() previous: string = '{}';
  @Input() current: string = '{}';
  @Input() refType: RefTypeEnum;
  @Input() refs: IRefType;
  @Output() onSave = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<any>();

  title: string;
  reviewModalKindEnum = ReviewModalKindEnum;
  numChanges = 0;
  instructions: IInstruction[] = [];
  form: FormGroup;

  hasSchedule: boolean = false;
  today = new Date();
  timeDefaultValue = setSeconds(setMinutes(setHours(new Date(), this.today.getHours()), this.today.getMinutes()), 0);

  constructor(
    private fb: FormBuilder,
    private auditLogService: AuditLogService
  ) {
  }

  scheduleValidator: ValidatorFn = (control: AbstractControl) => {
    if (this.hasSchedule && !control.value) {
      const error = { required: true };
      control.setErrors(error);
      return error;
    }

    return null;
  }

  async ngOnChanges() {
    if (this.visible) {
      if (this.kind === ReviewModalKindEnum.Schedule) {
        this.title = $localize `:@@common.schedule-changes:Schedule changes`;
        this.hasSchedule = true;
      } else {
        this.title =$localize `:@@common.review-and-save:Review and save`;
        this.hasSchedule = false;
      }

      this.form = this.fb.group({
        comment: ['', []],
        scheduleTitle: ['', [this.scheduleValidator]],
        scheduledTime: [null, [this.scheduleValidator]],
      });

      try {
        this.instructions = await this.auditLogService.compare(this.refType, JSON.parse(this.previous), JSON.parse(this.current));
      } catch(e) {}
    }
  }

  onValidate() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      return;
    }

    const { comment, scheduleTitle, scheduledTime } = this.form.value;

    const output: ChangeReviewOutput = {
      comment: comment,
      schedule: this.hasSchedule ? {
        title: scheduleTitle,
        scheduledTime: scheduledTime,
      } : undefined,
    };

    this.onSave.emit(output);
  }

  closeModal() {
    this.onCancel.emit();
  }

  range(start: number, end: number): number[] {
    const result: number[] = [];
    for (let i = start; i < end; i++) {
      result.push(i);
    }
    return result;
  }

  // Can not select days before today and today
  disabledDate = (current: Date): boolean => differenceInCalendarDays(current, this.today) < 0;

  disabledDateTime: DisabledTimeFn = (current: Date) => ({
    nzDisabledHours: () => {
      if (differenceInCalendarDays(current, this.today) === 0) {
        return this.range(0, 24).slice(0, this.today.getHours());
      }

      return [];
    },
    nzDisabledMinutes: () => {
      if (differenceInCalendarDays(current, this.today) === 0 && current.getHours() === this.today.getHours()) {
        return this.range(0, 60).slice(0, this.today.getMinutes());
      }

      return [];
    },
    nzDisabledSeconds: () => []
  });

  toggleSchedule() {
    this.hasSchedule = !this.hasSchedule;
  }
}
