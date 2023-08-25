import { Component } from "@angular/core";
import { IInstructionComponent, IInstructionComponentData } from "@core/components/change-list/instructions/types";

@Component({
  selector: 'turn-flag-off',
  template: `
    <div class="instruction">
      <span i18n="@@common.turn-flag-off">Turn feature flag </span><nz-tag>OFF</nz-tag>
    </div>
  `,
  styleUrls: ['./turn-flag-off.component.less']
})
export class TurnFlagOffComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
