import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  ChangeRequestAction,
  PendingChangeStatus,
  IPendingChanges,
  IReviewer,
  PendingChangeType
} from "@core/components/pending-changes-drawer/types";
import { IInstruction } from "@core/components/change-list/instructions/types";
import { FeatureFlagService } from "@services/feature-flag.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { getProfile } from "@utils/index";

class ChangeCategory {
  get statusLabel() : string {
    return this.getStatusTranslation(this.status);
  };

  constructor(
    public id: string,
    public type: PendingChangeType,
    public createdAt: string,
    public creatorId: string,
    public creator: string,
    public instructions: IInstruction[],
    public previous: string,
    public current: string,
    public scheduleTitle: string,
    public scheduledTime: string,
    public changeRequestId: string,
    public changeRequestReason: string,
    public status: PendingChangeStatus,
    public reviewers: IReviewer[]) {
    if (this.type === PendingChangeType.ChangeRequest) {
      this.changeRequestId = this.id;
    }
  }

  get hasChangeRequest(): boolean {
    return this.changeRequestId !== null || this.type === PendingChangeType.ChangeRequest;
  }

  canDecline(currentUserId: string): boolean {
    if (!this.hasChangeRequest) {
      return false;
    }

    const reviewer = this.reviewers.find((item: IReviewer) => item.memberId === currentUserId);

    return reviewer && reviewer?.action !== ChangeRequestAction.Decline && this.status !== PendingChangeStatus.Applied;
  }

  canApprove(currentUserId: string): boolean {
    if (!this.hasChangeRequest) {
      return false;
    }

    const reviewer = this.reviewers.find((item: IReviewer) => item.memberId === currentUserId);

    return reviewer && reviewer?.action !== ChangeRequestAction.Approve && this.status !== PendingChangeStatus.Applied;
  }

  canApply(currentUserId: string): boolean {
    if (this.type !== PendingChangeType.ChangeRequest) {
      return false;
    }

    if (this.status !== PendingChangeStatus.Approved) {
      return false;
    }

    if (currentUserId === this.creatorId) {
      return true;
    }

    const reviewer = this.reviewers.find((item: IReviewer) => item.memberId === currentUserId);
    return reviewer?.action === ChangeRequestAction.Approve;
  }

  private getStatusTranslation(status: string) {
    switch (status) {
      case 'PendingReview':
        return $localize`:@@common.pending-review:Pending Review`;
      case 'PendingExecution':
        return $localize`:@@common.pending-execution:Pending Execution`;
      case 'Approved':
        return $localize`:@@common.approved:Approved`;
      case 'Declined':
        return $localize`:@@common.declined:Declined`;
      case 'Applied':
        return $localize`:@@common.applied:Applied`;
      default:
        return status;
    }
  }
}

@Component({
  selector: 'pending-changes-drawer',
  templateUrl: './pending-changes-drawer.component.html',
  styleUrls: ['./pending-changes-drawer.component.less']
})
export class PendingChangesDrawerComponent {
  changeCategoriesList: ChangeCategory[] = [];
  profile = getProfile();

  @Input() visible: boolean = false;
  @Input()
  set pendingChangesList(data: IPendingChanges[]) {
    this.changeCategoriesList = data.map((item: IPendingChanges) => new ChangeCategory(
      item.id,
      item.type,
      item.createdAt,
      item.creatorId,
      item.creatorName,
      item.instructions,
      item.dataChange.previous,
      item.dataChange.current,
      item.scheduleTitle,
      item.scheduledTime,
      item.changeRequestId,
      item.changeRequestReason,
      item.status,
      item.reviewers,
    ));
  }

  @Output() close: EventEmitter<any> = new EventEmitter();
  @Output() onItemRemoved: EventEmitter<any> = new EventEmitter();
  constructor(
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService
  ) { }

  removePendingChange(id: string, type: PendingChangeType) {
    const observer = {
      next: () => {
        this.onItemRemoved.emit(id);
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
      }
    };

    if (type === PendingChangeType.ChangeRequest) {
      this.featureFlagService.deleteChangeRequest(id).subscribe(observer);
    } else {
      this.featureFlagService.deleteSchedule(id).subscribe(observer);
    }
  }

  declineChangeRequest(param: ChangeCategory) {
    this.featureFlagService.declineChangeRequest(param.changeRequestId).subscribe({
      next: () => {
        const reviewer = param.reviewers.find((item: IReviewer) => item.memberId === this.profile.id);
        reviewer.action = ChangeRequestAction.Decline;
        param.status = PendingChangeStatus.Declined;
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
      }
    });
  }

  approveChangeRequest(param: ChangeCategory) {
    this.featureFlagService.approveChangeRequest(param.changeRequestId).subscribe({
      next: () => {
        const reviewer = param.reviewers.find((item: IReviewer) => item.memberId === this.profile.id);
        reviewer.action = ChangeRequestAction.Approve;
        if (param.type === PendingChangeType.ChangeRequest) {
          param.status = PendingChangeStatus.Approved;
        } else {
          param.status = PendingChangeStatus.PendingExecution;
        }

        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
      }
    });
  }

  applyChangeRequest(param: ChangeCategory) {
    this.featureFlagService.applyChangeRequest(param.changeRequestId).subscribe({
      next: () => {
        param.status = PendingChangeStatus.Applied;
        this.msg.success($localize`:@@common.operation-success-and-refresh-page:Operation succeeded, please refresh the page to see the changes`);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
      }
    });
  }

  onClose() {
    this.close.emit();
  }

  protected readonly PendingChangeType = PendingChangeType;
  protected readonly PendingChangeStatus = PendingChangeStatus;
}
