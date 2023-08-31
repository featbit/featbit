import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRolloutVariations,
} from "@core/components/change-list/instructions/types";
import { getPercentageFromRolloutPercentageArray } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

interface IRuleRollout {
  label: string;
  percentage: number;
}

@Component({
  selector: 'rule-variation-or-rollout',
  template: `
    <div class="instruction">
      <span i18n="@@common.update-serve-value-to">Update serve value to </span>
      <nz-tag *ngFor="let value of values">{{value.label}} ({{value.percentage}}%)</nz-tag>
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
export class UpdateRuleVariationOrRolloutComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get values(): IRuleRollout[] {
    const value = this.data.value as IRolloutVariations;
    const current = this.data.current as IFeatureFlag;

    return value.rolloutVariations.map((rv) => {
      const variation = current.variations.find((v) => v.id === rv.id);

      return {
        label: variation?.name || rv.id,
        percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
      }
    })
  }
}
