import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'update-off-variation',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-to">Update to</span>
      <nz-tag>{{variation.name}}: {{variation.value}}</nz-tag>
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
