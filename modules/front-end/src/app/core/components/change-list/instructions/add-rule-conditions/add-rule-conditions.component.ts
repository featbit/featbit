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
    <div class="instruction" *ngIf="!isLoading">
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
