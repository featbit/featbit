import { Component, EventEmitter, Input, Output } from "@angular/core";
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";
import { IInstruction } from "@core/components/change-list/instructions/types";
import { FeatureFlagService } from "@services/feature-flag.service";
import { NzMessageService } from "ng-zorro-antd/message";

interface IChangeCategory {
  id: string;
  createdAt: string;
  scheduledTime: string;
  creator: string;
  instructions: IInstruction[];
  previous: string;
  current: string;
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
      createdAt: item.createdAt,
      scheduledTime: item.scheduledTime,
      creator: item.creatorName,
      previous: item.dataChange.previous,
      current: item.dataChange.current,
      instructions: item.instructions,
    }));
  }
  @Output() close: EventEmitter<any> = new EventEmitter();
  @Output() onItemRemoved: EventEmitter<any> = new EventEmitter();
  constructor(
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService
  ) {
  }

  removeSchedule(scheduleId: string) {
    this.featureFlagService.deleteSchedule(scheduleId).subscribe({
      next: () => {
        this.onItemRemoved.emit(scheduleId);
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
      }
    });
  }

  onClose() {
    this.close.emit();
  }
}
