import { Component } from "@angular/core";
import { IInstructionComponent, IInstructionComponentData } from "@core/components/change-list/instructions/types";

@Component({
  selector: 'turn-flag-on',
  template: `
    <div class="instruction">
      <span i18n="@@common.turn-flag-on">Turn feature flag </span><nz-tag>ON</nz-tag>
    </div>
  `,
  styleUrls: ['./turn-flag-on.component.less']
})
export class TurnFlagOnComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
