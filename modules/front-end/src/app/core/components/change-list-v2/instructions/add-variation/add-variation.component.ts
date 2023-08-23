import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IVariationTargetUsers, IVariationValue,
} from "@core/components/change-list-v2/instructions/types";

@Component({
  selector: 'add-variation',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-variation">Add variation</span>
      <nz-tag>{{variation.name}}: {{variation.value}}</nz-tag>
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
export class AddVariationComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get variation(): IVariationValue {
    const value = this.data.value as IVariationValue;
    return value;
  }
}
