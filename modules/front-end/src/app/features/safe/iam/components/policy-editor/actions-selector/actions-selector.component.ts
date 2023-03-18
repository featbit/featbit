import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {NzSelectComponent} from "ng-zorro-antd/select";
import {IamPolicyAction} from "@shared/policy";

@Component({
  selector: 'actions-selector',
  templateUrl: './actions-selector.component.html',
  styleUrls: ['./actions-selector.component.less']
})
export class ActionsSelectorComponent {

  allActions: IamPolicyAction[];
  filteredActions: IamPolicyAction[];

  @Output() onSelectedActionsChange = new EventEmitter<IamPolicyAction[]>();
  @Input('actions')
  set _(data: IamPolicyAction[]) {
    this.allActions = data || [];
    this.filteredActions = [...this.allActions];
  }

  @Input() selectedActions: IamPolicyAction[] = [];
  @Input() isInvalid: boolean = false;

  @ViewChild("actionsSelector", { static: true }) selectNode: NzSelectComponent;
  actionSelectModel: IamPolicyAction;

  onActionChange() {
    this.selectedActions = [...this.selectedActions, {...this.actionSelectModel}];
    this.onSelectedActionsChange.next(this.selectedActions);
    this.selectNode.writeValue(undefined);
    this.validate();
  }

  validate() {
    this.isInvalid = this.selectedActions.length === 0;
  }

  removeAction(act: IamPolicyAction){
    this.selectedActions = this.selectedActions.filter(s => s.name !== act.name);
    this.onSelectedActionsChange.next(this.selectedActions);
    this.validate();
  }

  onSearchActions(query: string) {
    const regex = new RegExp(query, 'ig');
    this.filteredActions = this.allActions.filter(act => regex.test(act.name) || regex.test(act.displayName));
  }

  isActionSelected(act: IamPolicyAction) {
    return this.selectedActions.findIndex(s => s.name === act.name) !== -1;
  }

  getActionDigest(act: IamPolicyAction) {
    return act.name;
  }
}
