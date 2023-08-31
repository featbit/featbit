import { Component, EventEmitter, Input, Output } from "@angular/core";
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";
import { IInstruction } from "@core/components/change-list/instructions/types";

interface IChangeCategory {
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
    data.map((item: IPendingChanges) => {
      this.changeCategoriesList.push({
        createdAt: item.createdAt,
        scheduledTime: item.scheduledTime,
        creator: item.creatorName,
        previous: item.dataChange.previous,
        current: item.dataChange.current,
        instructions: item.instructions,
      });
    });
  }
  @Output() close: EventEmitter<any> = new EventEmitter();

  onClose() {
    this.close.emit();
  }
}
