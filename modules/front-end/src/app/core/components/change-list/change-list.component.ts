import {Component, Input} from "@angular/core";
import {IChange} from "@shared/diffv2/types";

@Component({
  selector: 'change-list',
  templateUrl: './change-list.component.html',
  styleUrls: ['./change-list.component.less']
})
export class ChangeListComponent {
  @Input() changes: IChange[] = []

  constructor() {
  }
}
