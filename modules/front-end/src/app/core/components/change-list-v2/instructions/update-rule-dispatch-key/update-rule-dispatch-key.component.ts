import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleDispatchKey,
} from "@core/components/change-list-v2/instructions/types";
@Component({
  selector: 'rule-dispatch-key',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-dispatch-key-to">Update dispatch key to </span><span class="value">{{dispatchKey}}</span>
    </div>
  `,
  styles: [`
    .value {
      font-weight: 700;
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
