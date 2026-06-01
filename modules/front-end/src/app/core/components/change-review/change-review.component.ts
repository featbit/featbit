import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, ValidatorFn } from "@angular/forms";
import { RefTypeEnum } from "@core/components/audit-log/types";
import {
  ChangeReviewModalData,
  ChangeReviewOutput,
  ReviewModalKindEnum,
  ReviewModalMode
} from "@core/components/change-review/types";
import { differenceInCalendarDays, setHours, setMinutes, setSeconds } from 'date-fns';
import { DisabledTimeFn } from "ng-zorro-antd/date-picker";
import { AuditLogService } from "@services/audit-log.service";
import { IInstruction } from "@core/components/change-list/instructions/types";
import { EnvironmentSetting, License, LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense, getCurrentProjectEnv } from "@utils/project-env";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { getProfile } from "@utils/index";
import { OrganizationService } from "@services/organization.service";
import { MemberFilter } from "@features/safe/iam/types/member";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'change-review',
  templateUrl: './change-review.component.html',
  styleUrls: [ './change-review.component.less' ],
  standalone: false
})
export class ChangeReviewComponent implements OnInit {
  kind: ReviewModalKindEnum = ReviewModalKindEnum.Save;
  envSettings: EnvironmentSetting;
  title: string;
  instructions: IInstruction[] = [];
  form: FormGroup;
  license: License;
  today = new Date();
  timeDefaultValue = setSeconds(setMinutes(setHours(new Date(), this.today.getHours()), this.today.getMinutes()), 0);

  constructor(
    private fb: FormBuilder,
    private organizationService: OrganizationService,
    private auditLogService: AuditLogService,
    private message: NzMessageService
  ) { }

  private _visible = false;
  @Input()
  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.form = this.fb.group({
        comment: ['', [this.commentValidator]],
        scheduleTitle: ['', [this.scheduleValidator]],
        scheduledTime: [null, [this.scheduleValidator]],
        changeRequestReason: ['', [this.changeRequestValidator]],
        reviewers: [[], [this.changeRequestValidator]],
      });
    }
  }
  get visible() {
    return this._visible;
  }

  private _data: ChangeReviewModalData;
  @Input()
  set data(value: ChangeReviewModalData) {
    this._data = value;
    if (value) {
      this.kind = value.kind;
      this.setTitle();
      this.loadChanges();
    }
  }
  get data() {
    return this._data;
  }

  @Output() onSave = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<any>();

  ngOnInit(): void {
    this.license = getCurrentLicense();
    this.envSettings = getCurrentProjectEnv()!.envSettings;

    const profile = getProfile();
    this.memberSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(searchText => {
      this.organizationService.getMemberList(new MemberFilter(searchText)).subscribe({
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

  changes: number = 0;
  isLoadingChanges: boolean = false;
  loadChanges() {
    this.isLoadingChanges = true;
    const { refType, previous, current } = this._data;
    this.auditLogService.compare(refType, previous, current).subscribe({
      next: (instructions) => {
        this.instructions = instructions;
        this.changes = new Set(instructions.map(i => i.kind)).size;
        this.isLoadingChanges = false;
      },
      error: _ => {
        this.isLoadingChanges = false;
        this.message.error($localize `:@@common.load-changes-failed:Failed to load changes`);
      }
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

  commentValidator: ValidatorFn = (control: AbstractControl) => {
    const isNormalMode = !ReviewModalMode.isScheduleEnabled(this.kind) && !ReviewModalMode.isChangeRequestEnabled(this.kind);
    if (this.envSettings?.requireChangeComment && isNormalMode && !control.value?.trim()) {
      const error = { required: true };
      control.setErrors(error);
      return error;
    } else {
      control.setErrors(null);
    }

    return null;
  }

  setTitle() {
    const kind = this.kind;

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

  doSubmit() {
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

  setNormalMode() {
    if (ReviewModalMode.isScheduleEnabled(this.kind)) {
      this.kind = ReviewModalMode.disableSchedule(this.kind);
    }
    if (ReviewModalMode.isChangeRequestEnabled(this.kind)) {
      this.kind = ReviewModalMode.disableChangeRequest(this.kind);
    }
  }

  toggleChangeRequest() {
    if (ReviewModalMode.isChangeRequestEnabled(this.kind)) {
      this.kind = ReviewModalMode.disableChangeRequest(this.kind);
    } else {
      this.kind = ReviewModalMode.enableChangeRequest(this.kind);
    }
  }

  memberSearchChange$ = new Subject<string>();
  isMemberLoading = false;
  memberList: any[];
  onSearchMember(value: string) {
    this.isMemberLoading = true;
    this.memberSearchChange$.next(value);
  }

  protected readonly RefTypeEnum = RefTypeEnum;
  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
  protected readonly ReviewModalMode = ReviewModalMode;
}
