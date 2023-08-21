import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'remove-variation',
  template: `
    <div class="instruction">
      <span i18n="@@common.remove-variation">Remove variation</span>
      <nz-tag>{{variation.name}}</nz-tag>
      <span i18n="@@common.add">with value</span>
      <nz-tag>{{variation.value}}</nz-tag>
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
export class RemoveVariationComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get variation(): IVariation {
    const previousFlag = this.data.previous as IFeatureFlag;
    const variationId = this.data.value as string;
    return previousFlag.variations.find(v => v.id === variationId);
  }
}
