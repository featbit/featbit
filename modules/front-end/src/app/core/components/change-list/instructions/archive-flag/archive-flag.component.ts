import { Component } from "@angular/core";
import { IInstructionComponent, IInstructionComponentData } from "@core/components/change-list/instructions/types";
@Component({
  selector: 'archive-flag',
  template: `
    <div class="instruction">
      <ng-container i18n="@@common.archive-flag">Archive feature flag</ng-container>
    </div>
  `
})
export class ArchiveFlagComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
