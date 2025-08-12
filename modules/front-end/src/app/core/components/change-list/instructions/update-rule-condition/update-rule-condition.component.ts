import { Component, OnInit } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IInstructionCondition, IRuleCondition
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { SegmentService } from "@services/segment.service";
import { getSegmentRefs, mapToIInstructionCondition } from "@core/components/change-list/instructions/utils";
import { ICondition } from "@shared/rules";

@Component({
  selector: 'update-rule-condition',
  template: `
    @if (!isLoading) {
      <div class="instruction">
        <span i18n="@@common.update-conditions">Update condition</span>
        <div class="clause">
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
      </div>
    }
    `,
  styleUrls: ['./update-rule-condition.component.less']
})
export class UpdateRuleConditionComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  condition: IInstructionCondition;

  constructor(private segmentService: SegmentService) { }

  async ngOnInit() {
    await this.getCondition();
    this.isLoading = false;
  }

  async getCondition() {
    const ruleCondition = this.data.value as IRuleCondition;
    let originalCondition = ruleCondition.condition as ICondition;

    let segmentRefs = isSegmentCondition(originalCondition.property)
      ? await getSegmentRefs(this.segmentService, JSON.parse(originalCondition.value))
      : { };

    this.condition = mapToIInstructionCondition(originalCondition, segmentRefs);
  }
}
