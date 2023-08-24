import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IRolloutVariations,
} from "@core/components/change-list-v2/instructions/types";
import { getPercentageFromRolloutPercentageArray, isSegmentCondition } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { IRule } from "@shared/rules";
import { findIndex, ruleOps } from "@core/components/find-rule/ruleConfig";
import { lastValueFrom } from "rxjs";
import { SegmentService } from "@services/segment.service";
import { ISegment } from "@features/safe/segments/types/segments-index";

interface IRuleRollout {
  label: string;
  percentage: number;
}

@Component({
  selector: 'describe-rule',
  template: `
    <div class="instruction">
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
      <ng-container *ngIf="rollouts?.length > 0">
        <div class="serve">
          <span i18n="@@differ.serve">Serve</span>
          <nz-tag class="serve-value" *ngFor="let rollout of rollouts">
            {{rollout.label}} <ng-container *ngIf="rollouts.length > 1">({{rollout.percentage}}%)</ng-container>
          </nz-tag>
        </div>
        <div class="dispatch-by" *ngIf="rollouts?.length > 1">
          <span i18n="@@differ.dispatch-by">Dispatch by</span>
          <nz-tag>{{rule.dispatchKey}}</nz-tag>
        </div>
      </ng-container>
    </div>
  `,
  styleUrls: ['./describe-rule.component.less']
})
export class DescribeRuleComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  constructor(private segmentService: SegmentService) {}

  get rule(): IRule {
    return this.data.value as IRule;
  }

  get conditions() {
    const segmentIds = this.rule.conditions.filter(isSegmentCondition).flatMap(condition => JSON.parse(condition.value));
    this.getSegmentRefs(segmentIds);

    return this.rule.conditions.map(condition => {
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

  get rollouts(): IRuleRollout[] {
    const current = this.data.current as IFeatureFlag;

    return this.rule.variations.map((rv) => {
      const variation = current.variations.find((v) => v.id === rv.id);

      return {
        label: variation?.name || rv.id,
        percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
      }
    })
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
