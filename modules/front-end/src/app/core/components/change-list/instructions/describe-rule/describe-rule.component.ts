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
    @if (!isLoading) {
      <div class="instruction">
        @for (condition of conditions; track condition.id || condition.property; let idx = $index) {
          <div class="clause">
            @if (idx !==0) {
              <span>And</span>
            }
            <span i18n="@@common.capitalize-if">If</span>
            <span>{{condition.property}}</span>
            @if (condition.op !== null) {
              <span>{{condition.opLabel}}</span>
            }
            @if (condition.displayValue) {
              @if (!condition.isMultiValue) {
                <nz-tag>{{condition.value}}</nz-tag>
              }
              @if (condition.isMultiValue) {
                @for (value of condition.value; track value) {
                  <nz-tag>{{value}}</nz-tag>
                }
              }
            }
          </div>
        }
        @if (rollouts?.length > 0) {
          <div class="serve">
            <span i18n="@@differ.serve">Serve</span>
            @for (rollout of rollouts; track rollout.label || rollout.percentage) {
              <nz-tag class="serve-value">
                {{rollout.label}} @if (rollouts.length > 1) {
                ({{rollout.percentage}}%)
              }
            </nz-tag>
          }
        </div>
        @if (rollouts?.length > 1) {
          <div class="dispatch-by">
            <span i18n="@@differ.dispatch-by">Dispatch by</span>
            <nz-tag>{{rule.dispatchKey}}</nz-tag>
          </div>
        }
      }
    </div>
    }
    `,
    styleUrls: ['./describe-rule.component.less'],
    standalone: false
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
