import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
@Component({
  selector: 'default-rule-dispatch-key',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-dispatch-key-to">Update dispatch key to</span><span class="value">{{data.value}}</span>
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
export class UpdateDefaultRuleDispatchKeyComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
