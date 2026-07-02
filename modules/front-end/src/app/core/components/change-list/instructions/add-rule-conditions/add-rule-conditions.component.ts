import { Component, OnInit } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IInstructionCondition, IRuleConditions,
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { SegmentService } from "@services/segment.service";
import { getSegmentRefs, mapToIInstructionCondition } from "@core/components/change-list/instructions/utils";
import { ICondition } from "@shared/rules";

@Component({
    selector: 'add-rule-conditions',
    template: `
    @if (!isLoading) {
      <div class="instruction">
        <span i18n="@@common.add-conditions">Add conditions</span>
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
              @if (condition.isMultiValue) {
                @for (value of condition.value; track value) {
                  <nz-tag>{{value}}</nz-tag>
                }
              } @else {
                <nz-tag>{{condition.value}}</nz-tag>
              }
            }
          </div>
        }
      </div>
    }
    `,
    styleUrls: ['./add-rule-conditions.component.less'],
    standalone: false
})
export class AddRuleConditionsComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  conditions: IInstructionCondition[];

  constructor(private segmentService: SegmentService) {}

  ngOnInit(): void {
    this.setConditions();
  }

  async setConditions() {
    const ruleConditions = this.data.value as IRuleConditions;
    const segmentIds = ruleConditions.conditions.filter(({ property }) => isSegmentCondition(property)).flatMap(condition => JSON.parse(condition.value));

    const segmentRefs = await getSegmentRefs(this.segmentService, segmentIds);

    this.conditions = ruleConditions.conditions.map((condition) => mapToIInstructionCondition(condition as ICondition, segmentRefs));
    this.isLoading = false;
  }
}
