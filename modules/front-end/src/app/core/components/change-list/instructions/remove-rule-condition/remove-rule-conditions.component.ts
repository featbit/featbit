import { Component, OnInit } from "@angular/core";
import {
  IInstructionCondition,
  IInstructionComponent,
  IInstructionComponentData, IRuleConditionIds
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { SegmentService } from "@services/segment.service";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { getSegmentRefs, mapToIInstructionCondition } from "@core/components/change-list/instructions/utils";

@Component({
  selector: 'remove-rule-condition',
  template: `
    <div class="instruction" *ngIf="!isLoading">
      <span i18n="@@common.remove-conditions">Remove conditions</span>
      <div class="clause" *ngFor="let condition of conditions; let idx = index">
        <span *ngIf="idx !==0">And</span>
        <span i18n="@@common.capitalize-if">If</span>
        <span>{{condition.property}}</span>
        <span *ngIf="condition.op !== null">{{condition.opLabel}}</span>
        <ng-container *ngIf="condition.displayValue">
          <nz-tag *ngIf="!condition.isMultiValue">{{condition.value}}</nz-tag>
          <ng-container *ngIf="condition.isMultiValue">
            <nz-tag *ngFor="let value of condition.value">{{value}}</nz-tag>
          </ng-container>
        </ng-container>
      </div>
    </div>
  `,
  styleUrls: ['./remove-rule-conditions.component.less']
})
export class RemoveRuleConditionsComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  conditions: IInstructionCondition[];

  constructor(private segmentService: SegmentService) {}

  ngOnInit(): void {
    this.setConditions();
  }

  async setConditions() {
    const ruleConditionIds = this.data.value as IRuleConditionIds;
    const previous = this.data.previous as IFeatureFlag | ISegment;
    const conditions = previous.rules.find(r => r.id === ruleConditionIds.ruleId)?.conditions?.filter(c => ruleConditionIds.conditionIds.includes(c.id)) ?? [];

    const segmentIds = conditions.filter(({ property }) => isSegmentCondition(property)).flatMap(condition => JSON.parse(condition.value));
    const segmentRefs = await getSegmentRefs(this.segmentService, segmentIds);

    this.conditions = conditions.map(condition => mapToIInstructionCondition(condition, segmentRefs));
    this.isLoading = false;
  }
}
