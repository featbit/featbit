import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn } from "@angular/forms";
import { RefTypeEnum } from "@core/components/audit-log/types";
import { ChangeReviewOutput, ReviewModalKindEnum, ReviewModalMode } from "@core/components/change-review/types";
import { differenceInCalendarDays, setHours, setMinutes, setSeconds } from 'date-fns';
import { DisabledTimeFn } from "ng-zorro-antd/date-picker";
import { environment } from "src/environments/environment";
import { AuditLogService } from "@services/audit-log.service";
import { IInstruction } from "@core/components/change-list/instructions/types";
import { License, LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense } from "@utils/project-env";
import { BehaviorSubject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { TeamService } from "@services/team.service";
import { getProfile } from "@utils/index";

@Component({
  selector: 'change-review',
  templateUrl: './change-review.component.html',
  styleUrls: ['./change-review.component.less']
})
export class ChangeReviewComponent implements OnChanges, OnInit {
  @Input() visible = false;
  @Input() refName: string = '';
  @Input() kind: ReviewModalKindEnum = ReviewModalKindEnum.Save;
  @Output() kindChange= new EventEmitter<ReviewModalKindEnum>();
  @Input() previous: string = '{}';
  @Input() current: string = '{}';
  @Input() refType: RefTypeEnum;
  @Output() onSave = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<any>();

  title: string;
  instructions: IInstruction[] = [];
  form: FormGroup;

  license: License;
  today = new Date();
  timeDefaultValue = setSeconds(setMinutes(setHours(new Date(), this.today.getHours()), this.today.getMinutes()), 0);

  constructor(
    private fb: FormBuilder,
    private teamService: TeamService,
    private auditLogService: AuditLogService
  ) { }

  ngOnInit(): void {
    this.license = getCurrentLicense();

    const profile = getProfile();
    this.memberSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(searchText => {
      this.teamService.search(searchText).subscribe({
        next: (result) => {
          this.memberList = result.items.filter(itm => itm.id !== profile.id);
          this.isMemberLoading = false;
        },
        error: _ => {
          this.isMemberLoading = false;
        }
      });
    });
  }

  scheduleValidator: ValidatorFn = (control: AbstractControl) => {
    if (this.license.isGranted(LicenseFeatureEnum.Schedule) && ReviewModalMode.isScheduleEnabled(this.kind) && !control.value) {
      const error = { required: true };
      control.setErrors(error);
      return error;
    } else {
      control.setErrors(null);
    }

    return null;
  }

  changeRequestValidator: ValidatorFn = (control: AbstractControl) => {
    if (this.license.isGranted(LicenseFeatureEnum.ChangeRequest) && ReviewModalMode.isChangeRequestEnabled(this.kind) && (!control.value || control.value.length === 0)) {
      const error = { required: true };
      control.setErrors(error);
      return error;
    } else {
      control.setErrors(null);
    }

    return null;
  }

  setTitle(kind: ReviewModalKindEnum) {
    if (!ReviewModalMode.isScheduleEnabled(kind) && !ReviewModalMode.isChangeRequestEnabled(kind)) {
      this.title = $localize `:@@common.review-and-save:Review and save`;
      return;
    }

    if (ReviewModalMode.isChangeRequestEnabled(kind)) {
      this.title = $localize `:@@common.change-request:Change Request`;
    }

    if (ReviewModalMode.isScheduleEnabled(kind)) {
      this.title = $localize `:@@common.schedule-changes:Schedule changes`;
    }
  }

  async ngOnChanges() {
    if (this.visible) {
      this.setTitle(this.kind);

      this.form = this.fb.group({
        comment: ['', []],
        scheduleTitle: ['', [this.scheduleValidator]],
        scheduledTime: [null, [this.scheduleValidator]],
        changeRequestReason: ['', [this.changeRequestValidator]],
        reviewers: [[], [this.changeRequestValidator]],
      });

      try {
        this.instructions = await this.auditLogService.compare(this.refType, this.previous, this.current);
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

      if (this.form.invalid) {
        return;
      }
    }

    const { comment, scheduleTitle, scheduledTime, changeRequestReason, reviewers } = this.form.value;

    const output: ChangeReviewOutput = {
      comment: comment,
      schedule: this.license.isGranted(LicenseFeatureEnum.Schedule) && ReviewModalMode.isScheduleEnabled(this.kind) ? {
        title: scheduleTitle,
        scheduledTime: scheduledTime,
      } : undefined,
      changeRequest: this.license.isGranted(LicenseFeatureEnum.ChangeRequest) && ReviewModalMode.isChangeRequestEnabled(this.kind) ? {
        reason: changeRequestReason,
        reviewers: reviewers,
      } : undefined,
    };

    this.kindChange.emit(this.kind);
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
    if (ReviewModalMode.isScheduleEnabled(this.kind)) {
      this.kind = ReviewModalMode.disableSchedule(this.kind);
    } else {
      this.kind = ReviewModalMode.enableSchedule(this.kind);
    }
  }

  toggleChangeRequest() {
    if (ReviewModalMode.isChangeRequestEnabled(this.kind)) {
      this.kind = ReviewModalMode.disableChangeRequest(this.kind);
    } else {
      this.kind = ReviewModalMode.enableChangeRequest(this.kind);
    }
  }

  memberSearchChange$ = new BehaviorSubject('');
  isMemberLoading = false;
  memberList: any[];
  onSearchMember(value: string) {
    this.isMemberLoading = true;
    this.memberSearchChange$.next(value);
  }

  protected readonly environment = environment;
  protected readonly RefTypeEnum = RefTypeEnum;
  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
  protected readonly ReviewModalMode = ReviewModalMode;
}
