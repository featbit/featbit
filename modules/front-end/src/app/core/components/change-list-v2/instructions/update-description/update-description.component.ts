import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";
@Component({
  selector: 'update-description',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-description-to">Update description to </span><span class="value">{{data.value}}</span>
    </div>
  `,
  styles: [`
    .value {
      font-weight: 700;
    }
  `]
})
export class UpdateDescriptionComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
