import { Component, EventEmitter, Input, Output } from "@angular/core";
import { IPendingChanges, PendingChangeType } from "@core/components/pending-changes-drawer/types";
import { IInstruction } from "@core/components/change-list/instructions/types";
import { FeatureFlagService } from "@services/feature-flag.service";
import { NzMessageService } from "ng-zorro-antd/message";

interface IChangeCategory {
  id: string;
  type: PendingChangeType;
  createdAt: string;
  creator: string;
  instructions: IInstruction[];
  previous: string;
  current: string;
  scheduleTitle: string;
  scheduledTime: string;
  changeRequestId?: string;
  changeRequestReason?: string;
  changeRequestStatus: string;
}

function getChangeRequestStatusTranslation(status: string) {
  switch (status) {
    case 'Pending':
      return $localize`:@@common.pending:Pending review`;
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

@Component({
  selector: 'pending-changes-drawer',
  templateUrl: './pending-changes-drawer.component.html',
  styleUrls: ['./pending-changes-drawer.component.less']
})
export class PendingChangesDrawerComponent {
  changeCategoriesList: IChangeCategory[] = [];

  @Input() visible: boolean = false;
  @Input()
  set pendingChangesList(data: IPendingChanges[]) {
    this.changeCategoriesList = data.map((item: IPendingChanges) => ({
      id: item.id,
      type: item.type,
      createdAt: item.createdAt,
      scheduledTime: item.scheduledTime,
      creator: item.creatorName,
      previous: item.dataChange.previous,
      current: item.dataChange.current,
      instructions: item.instructions,
      scheduleTitle: item.scheduleTitle,
      changeRequestId: item.changeRequestId,
      changeRequestReason: item.changeRequestReason,
      changeRequestStatus: getChangeRequestStatusTranslation(item.changeRequestStatus)
    }));
  }

  @Output() close: EventEmitter<any> = new EventEmitter();
  @Output() onItemRemoved: EventEmitter<any> = new EventEmitter();
  constructor(
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService
  ) { }

  removeSchedule(id: string, type: PendingChangeType) {
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

  onClose() {
    this.close.emit();
  }

  protected readonly PendingChangeType = PendingChangeType;
}
