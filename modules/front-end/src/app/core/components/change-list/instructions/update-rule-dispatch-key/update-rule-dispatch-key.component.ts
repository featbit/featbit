import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleDispatchKey,
} from "@core/components/change-list/instructions/types";
@Component({
  selector: 'rule-dispatch-key',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-dispatch-key-to">Update dispatch key to</span><span class="value">{{dispatchKey}}</span>
    </div>
  `,
  styles: [`
    .value {
      display: inline-block;
      font-weight: 700;
      margin-left: 4px;
      margin-right: 4px;
    }
  `]
})
export class UpdateRuleDispatchKeyComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get dispatchKey(): string {
    const value = this.data.value as IRuleDispatchKey;
    return value.dispatchKey;
  }
}
