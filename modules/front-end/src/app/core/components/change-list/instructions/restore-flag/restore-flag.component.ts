import { Component } from "@angular/core";
import { IInstructionComponent, IInstructionComponentData } from "@core/components/change-list/instructions/types";
@Component({
  selector: 'restore-flag',
  template: `
    <div class="instruction">
      <ng-container i18n="@@common.restore-flag">Restore feature flag</ng-container>
    </div>
  `
})
export class RestoreFlagComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
