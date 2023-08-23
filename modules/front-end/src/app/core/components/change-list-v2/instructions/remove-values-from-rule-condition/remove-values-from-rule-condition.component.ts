import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleConditionValues
} from "@core/components/change-list-v2/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { findIndex, ruleOps } from "@core/components/find-rule/ruleConfig";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { lastValueFrom } from "rxjs";
import { SegmentService } from "@services/segment.service";

@Component({
  selector: 'remove-values-from-rule-condition',
  template: `
    <div class="instruction">
      <span i18n="@@common.capitalize-add">Remove</span>
      <span i18n="@@common.values-with-surrounding-space" *ngIf="values.length > 1"> values </span>
      <span i18n="@@common.value-with-surrounding-space" *ngIf="values.length === 1"> value </span>
      <nz-tag *ngFor="let value of values">
        {{value}}
      </nz-tag>
      <span i18n="@@common.to-condition">from condition</span>
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
export class RemoveValuesFromRuleConditionComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  constructor(private segmentService: SegmentService) {}

  get condition() {
    const previous = this.data.previous as IFeatureFlag | ISegment;
    const ruleConditionValues = this.data.value as IRuleConditionValues;
    const condition = previous.rules.find(r => r.id === ruleConditionValues.ruleId)?.conditions?.find(c => c.id === ruleConditionValues.conditionId);

    const isSegment = isSegmentCondition(condition);

    if (!isSegment) {
      const ruleOpIdx = findIndex(condition.op);
      const isMultiValue = ruleOps[ruleOpIdx].type === 'multi';

      return {
        property: condition.property,
        op: condition.op,
        opLabel: ruleOps[ruleOpIdx].label,
        displayValue: !['IsTrue', 'IsFalse'].includes(condition.op),
        value: isMultiValue ? JSON.parse(condition.value) : condition.value,
        isMultiValue
      }
    } else {
      this.getSegmentRefs(JSON.parse(condition.value));

      return {
        property: condition.property,
        op: null,
        displayValue: !['IsTrue', 'IsFalse'].includes(condition.op),
        value: JSON.parse(condition.value).map((segmentId) => this.segmentRefs[segmentId]?.name ?? segmentId),
        isMultiValue: true
      }
    }
  }

  get values() {
    const ruleConditionValues = this.data.value as IRuleConditionValues;
    return ruleConditionValues.values;
  }

  segmentRefs: {[key: string]: ISegment } = {};
  private async getSegmentRefs(segmentIds: string[]) {
    const missingKeyIds = segmentIds.filter((id) => !this.segmentRefs[id]);
    const segments = missingKeyIds.length === 0 ? [] : await lastValueFrom(this.segmentService.getByIds(missingKeyIds));

    this.segmentRefs = {
      ...this.segmentRefs,
      ...segments.reduce((acc, cur) => {
        acc[cur.id] = cur;
        return acc;
      }, {})
    };
  }
}
