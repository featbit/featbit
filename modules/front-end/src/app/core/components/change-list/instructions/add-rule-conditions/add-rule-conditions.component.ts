import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRuleConditions,
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { findIndex, ruleOps } from "@core/components/find-rule/ruleConfig";
import { lastValueFrom } from "rxjs";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { SegmentService } from "@services/segment.service";

@Component({
  selector: 'add-rule-conditions',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-conditions">Add conditions</span>
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
  styleUrls: ['./add-rule-conditions.component.less']
})
export class AddRuleConditionsComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  constructor(private segmentService: SegmentService) {}

  get conditions() {
    const ruleConditions = this.data.value as IRuleConditions;

    const segmentIds = ruleConditions.conditions.filter(isSegmentCondition).flatMap(condition => JSON.parse(condition.value));
    this.getSegmentRefs(segmentIds);

    return ruleConditions.conditions.map(condition => {
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
        return {
          property: condition.property,
          op: null,
          displayValue: !['IsTrue', 'IsFalse'].includes(condition.op),
          value: JSON.parse(condition.value).map((segmentId) => this.segmentRefs[segmentId]?.name ?? segmentId),
          isMultiValue: true
        }
      }
    });
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
