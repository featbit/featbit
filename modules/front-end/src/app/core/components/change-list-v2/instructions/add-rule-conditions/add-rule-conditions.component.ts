import { Component } from "@angular/core";
import {
  ICondition,
  IInstructionComponent,
  IInstructionComponentData, IRuleConditions, IVariationTargetUsers,
} from "@core/components/change-list-v2/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'add-rule-conditions',
  template: `
    <div class="instruction">
      <span i18n="@@common.capitalize-to">Add conditions</span>
      <span i18n="@@common.add">add</span>
      <nz-tag *ngFor="let condition of conditions">
        {{keyId}}
      </nz-tag>
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
export class AddRuleConditionsComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get variation(): string {
    const currentFlag = this.data.current as IFeatureFlag;
    const value = this.data.value as IVariationTargetUsers;
    return currentFlag.variations.find((v) => v.id === value.variationId)?.name ?? value.variationId;
  }

  get conditions(): ICondition[] {
    const ruleConditions = this.data.value as IRuleConditions;
    return ruleConditions.conditions;
  }
}
