import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";
@Component({
  selector: 'rule-dispatch-key',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-dispatch-key-to">Update dispatch key to </span><span class="value">{{data.value}}</span>
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
}
