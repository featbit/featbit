import { Component, OnInit } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IInstructionCondition, IRuleConditionValues
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { SegmentService } from "@services/segment.service";
import { getSegmentRefs, mapToIInstructionCondition } from "@core/components/change-list/instructions/utils";

@Component({
  selector: 'remove-values-from-rule-condition',
  template: `
    <div class="instruction" *ngIf="!isLoading">
      <span i18n="@@common.remove-values">Remove value(s)</span>
      <nz-tag *ngFor="let value of values">
        {{value}}
      </nz-tag>
      <span i18n="@@common.from-condition">from condition</span>
      <div class="clause">
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
  styleUrls: ['./remove-values-from-rule-condition.component.less']
})
export class RemoveValuesFromRuleConditionComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  condition: IInstructionCondition;
  values: string[];

  constructor(private segmentService: SegmentService) {}

  async ngOnInit() {
    await this.getCondition();
    await this.getValues();
    this.isLoading = false;
  }

  async getCondition() {
    const previous = this.data.previous as IFeatureFlag | ISegment;
    const ruleConditionValues = this.data.value as IRuleConditionValues;
    const condition = previous.rules.find(r => r.id === ruleConditionValues.ruleId)?.conditions?.find(c => c.id === ruleConditionValues.conditionId);
    const isSegment = isSegmentCondition(condition.property);

    let segmentRefs = {};
    if (isSegment) {
      segmentRefs = await getSegmentRefs(this.segmentService, JSON.parse(condition.value));
    }

    this.condition = mapToIInstructionCondition(condition, segmentRefs);
  }

  async getValues() {
    const ruleConditionValues = this.data.value as IRuleConditionValues;
    const previous = this.data.previous as IFeatureFlag | ISegment;
    const condition = previous.rules.find(r => r.id === ruleConditionValues.ruleId)?.conditions?.find(c => c.id === ruleConditionValues.conditionId);
    const isSegment = isSegmentCondition(condition.property);
    if (!isSegment) {
      ruleConditionValues.values
    }

    const segmentRefs: {[key: string]: ISegment } = await getSegmentRefs(this.segmentService, ruleConditionValues.values);
    this.values = Object.values(segmentRefs).map(x => x.name);
  }
}
