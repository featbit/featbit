import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'update-off-variation',
  template: `
    <div class="instruction">
      <span i18n="@@common.serve variation">Serve variation</span>
      <nz-tag>{{variation.name}}</nz-tag>
      <span i18n="@@common.add">with value</span>
      <nz-tag>{{variation.value}}</nz-tag>
      <span i18n="@@common.when-flag-is">when the flag is</span>
      <nz-tag class="off-tag">OFF</nz-tag>
    </div>
  `,
  styleUrls: ['./update-off-variation.component.less']
})
export class UpdateOffVariationComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get variation(): IVariation {
    const currentFlag = this.data.current as IFeatureFlag;
    const variationId = this.data.value as string;
    return currentFlag.variations.find(v => v.id === variationId);
  }
}
