import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
  IVariationValue,
} from "@core/components/change-list/instructions/types";
import { InstructionKindEnum } from "@core/components/change-list/constants";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'change-variations',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-variation" *ngIf="kind === InstructionKindEnum.AddVariation">Add variation</span>
      <span i18n="@@common.remove-variation" *ngIf="kind === InstructionKindEnum.RemoveVariation">Remove variation</span>
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
export class ChangeVariationsComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  protected readonly InstructionKindEnum = InstructionKindEnum;
  get kind() {
    return this.data.kind;
  }

  get variation(): IVariationValue {
    if (this.kind === InstructionKindEnum.AddVariation) {
      return this.data.value as IVariationValue;
    } else {
      const previousFlag = this.data.previous as IFeatureFlag;
      const variationId = this.data.value as string;
      return previousFlag.variations.find(v => v.id === variationId);
    }
  }
}
