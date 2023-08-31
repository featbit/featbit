import { Component, OnInit } from "@angular/core";
import {
  IInstructionCondition,
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
import { getPercentageFromRolloutPercentageArray, isSegmentCondition } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { IRule } from "@shared/rules";
import { SegmentService } from "@services/segment.service";
import {
  getSegmentRefs,
  mapToIInstructionCondition
} from "@core/components/change-list/instructions/utils";

interface IRuleRollout {
  label: string;
  percentage: number;
}

@Component({
  selector: 'describe-rule',
  template: `
    <div class="instruction" *ngIf="!isLoading">
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
export class DescribeRuleComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  conditions: IInstructionCondition[];

  constructor(private segmentService: SegmentService) {}

  get rule(): IRule {
    return this.data.value as IRule;
  }

  ngOnInit(): void {
    this.setConditions();
  }

  get rollouts(): IRuleRollout[] {
    const current = this.data.current as IFeatureFlag;

    return this.rule?.variations?.map((rv) => {
      const variation = current.variations.find((v) => v.id === rv.id);

      return {
        label: variation?.name || rv.id,
        percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
      }
    })
  }

  async setConditions() {
    const segmentIds = this.rule.conditions
      .filter(({ property }) => isSegmentCondition(property))
      .flatMap(condition => JSON.parse(condition.value))

    const segmentRefs = await getSegmentRefs(this.segmentService, segmentIds);
    this.conditions = this.rule.conditions.map((condition) => mapToIInstructionCondition(condition, segmentRefs));

    this.isLoading = false;
  }
}
