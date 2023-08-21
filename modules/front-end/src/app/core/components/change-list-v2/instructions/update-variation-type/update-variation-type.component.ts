import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";
@Component({
  selector: 'update-variation-type',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-variation-type-to">Update variation type to </span><span class="value">{{data.value}}</span>
    </div>
  `,
  styles: [`
    .value {
      font-weight: 700;
    }
  `]
})
export class UpdateVariationTypeComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
