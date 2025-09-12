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
    @if (!isLoading) {
      <div class="instruction">
        <span i18n="@@common.remove-conditions">Remove conditions</span>
        @for (condition of conditions; track condition; let idx = $index) {
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
      </div>
    }
    `,
    styleUrls: ['./remove-rule-conditions.component.less'],
    standalone: false
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
