import {Component, Input} from "@angular/core";
import {ICategory, IChange} from "@shared/diffv2/types";
import {ICondition} from "@shared/rules";

@Component({
  selector: 'change-list',
  templateUrl: './change-list.component.html',
  styleUrls: ['./change-list.component.less']
})
export class ChangeListComponent {
  @Input() categories: ICategory[] = []

  constructor() {
  }

  displayOldValue(change: IChange): boolean {
    return change.isMultiValue ? change.oldValue.length > 0 :
      (change.oldValue !== '' && change.oldValue !== undefined && change.oldValue != null);
  }

  displayNewValue(change: IChange): boolean {
    return change.isMultiValue ? change.value.length > 0 :
      (change.value !== '' && change.value !== undefined && change.value != null);
  }

  displayRuleClauseValue(condition: ICondition): boolean {
    return !['IsTrue', 'IsFalse'].includes(condition.op);
  }
}
