import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IVariationValue,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'update-variation',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-variation">Update variation</span>
      <nz-tag>{{previous.name}}: {{previous.value}}</nz-tag>
      <span i18n="@@common.to">to</span>
      <nz-tag>{{current.name}}:{{current.value}}</nz-tag>
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
export class UpdateVariationComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get previous(): IVariationValue {
    const previousFlag = this.data.previous as IFeatureFlag;
    const value = this.data.value as IVariationValue;
    const previousVariation = previousFlag.variations.find((v: IVariationValue) => v.id === value.id);

    return previousVariation;
  }

  get current(): IVariationValue {
    const value = this.data.value as IVariationValue;
    return value;
  }
}
