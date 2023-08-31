import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
@Component({
  selector: 'update-variation-type',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-variation-type-to">Update variation type to</span><nz-tag>{{data.value}}</nz-tag>
    </div>
  `,
  styles: [`
    nz-tag {
      line-height: 12px;
      height: 19px;
      border-radius: 5px;
      margin-left: 2px;
      margin-right: 2px;
    }
  `]
})
export class UpdateVariationTypeComponent implements IInstructionComponent {
  data: IInstructionComponentData;
}
