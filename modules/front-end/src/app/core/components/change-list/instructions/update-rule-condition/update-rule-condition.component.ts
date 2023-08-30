import { Component, OnInit } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IInstructionCondition, IRuleCondition, IRuleConditionValues
} from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { SegmentService } from "@services/segment.service";
import { getSegmentRefs, mapToIConstructionCondition } from "@core/components/change-list/instructions/utils";
import { ICondition } from "@shared/rules";

@Component({
  selector: 'update-rule-condition',
  template: `
    <div class="instruction" *ngIf="!isLoading">
      <span i18n="@@common.update-conditions">Update condition</span>
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
export class UpdateRuleConditionComponent implements IInstructionComponent, OnInit {
  data: IInstructionComponentData;

  isLoading: boolean = true;
  condition: IInstructionCondition;

  constructor(private segmentService: SegmentService) {}

  async ngOnInit() {
    await this.getCondition();
    this.isLoading = false;
  }

  async getCondition() {
    const ruleCondition = this.data.value as IRuleCondition;
    const isSegment = isSegmentCondition(ruleCondition.condition.property);

    let segmentRefs = {};
    if (isSegment) {
      segmentRefs = await getSegmentRefs(this.segmentService, JSON.parse(ruleCondition.condition.value));
    }

    this.condition = mapToIConstructionCondition(ruleCondition.condition as ICondition, segmentRefs);
  }
}
