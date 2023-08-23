import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleCondition
} from "@core/components/change-list-v2/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { findIndex, ruleOps } from "@core/components/find-rule/ruleConfig";
import { lastValueFrom } from "rxjs";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { SegmentService } from "@services/segment.service";

@Component({
  selector: 'update-rule-condition',
  template: `
    <div class="instruction">
      <span i18n="@@common.remove-conditions">Update condition</span>
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
  styleUrls: ['./update-rule-condition.component.less']
})
export class UpdateRuleConditionComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  constructor(private segmentService: SegmentService) {}

  get condition() {
    const ruleCondition = this.data.value as IRuleCondition;
    const isSegment = isSegmentCondition(ruleCondition.condition);

    if (!isSegment) {
      const ruleOpIdx = findIndex(ruleCondition.condition.op);
      const isMultiValue = ruleOps[ruleOpIdx].type === 'multi';

      return {
        property: ruleCondition.condition.property,
        op: ruleCondition.condition.op,
        opLabel: ruleOps[ruleOpIdx].label,
        displayValue: !['IsTrue', 'IsFalse'].includes(ruleCondition.condition.op),
        value: isMultiValue ? JSON.parse(ruleCondition.condition.value) : ruleCondition.condition.value,
        isMultiValue
      }
    } else {
      this.getSegmentRefs(JSON.parse(ruleCondition.condition.value));

      return {
        property: ruleCondition.condition.property,
        op: null,
        displayValue: !['IsTrue', 'IsFalse'].includes(ruleCondition.condition.op),
        value: JSON.parse(ruleCondition.condition.value).map((segmentId) => this.segmentRefs[segmentId]?.name ?? segmentId),
        isMultiValue: true
      }
    }
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
