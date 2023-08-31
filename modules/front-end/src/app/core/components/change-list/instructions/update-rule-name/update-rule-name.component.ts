import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleName,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";
@Component({
  selector: 'update-rule-name',
  template: `
    <div class="instruction">
      <ng-container *ngIf="!isClear">
        <span i18n="@@common.update-name-with-sufix-space">Update name </span>
        <ng-container *ngIf="previousName.length > 0">
          <span i18n="@@common.from-name">from</span>
          <span class="value remove-value">{{previousName}}</span>
        </ng-container>
        <span i18n="@@common.to-name">to</span>
        <span class="value">{{value.name}}</span>
      </ng-container>
      <ng-container *ngIf="isClear">
        <span i18n="@@common.clear-name">Clear name</span>
      </ng-container>
    </div>
  `,
  styles: [`
    .value {
      font-weight: 700;
      display: inline-block;
      margin-left: 4px;
      margin-right: 4px;
    }

    .remove-value {
      text-decoration: line-through;
    }
  `]
})
export class UpdateRuleNameComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get value(): IRuleName {
    return this.data.value as IRuleName;
  }

  get previousName(): string {
    const previous = this.data.previous as IFeatureFlag | ISegment;
    const previousRule = previous.rules.find(r => r.id === this.value.ruleId);
    return previousRule.name;
  }

  get isClear(): boolean {
    return this.value.name.length === 0;
  }
}
