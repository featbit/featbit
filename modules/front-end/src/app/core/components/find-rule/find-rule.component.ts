import { Component, EventEmitter, Input, Output, } from '@angular/core';
import { SegmentService } from '@services/segment.service';
import { isSegmentRule, trackByFunction } from '@utils/index';
import { ruleType, ruleValueConfig } from './ruleConfig';
import { ISegment } from "@features/safe/segments/types/segments-index";
import {
  IFftuwmtrParams,
  IJsonContent,
  IRulePercentageRollout,
  IVariationOption
} from "@features/safe/switch-manage/types/switch-new";
import { IUserProp } from "@shared/types";
import {USER_IS_IN_SEGMENT, USER_IS_NOT_IN_SEGMENT} from "@shared/constants";

@Component({
  selector: 'find-rule',
  templateUrl: './find-rule.component.html',
  styleUrls: ['./find-rule.component.less']
})
export class FindRuleComponent {

  constructor(
    private segmentService: SegmentService
  ) { }
  trackByFunction = trackByFunction;

  segmentList: ISegment[] = [];

  @Input()
  set data(value: IFftuwmtrParams) {
    this.ruleName = value.ruleName;
    this.rulePercentageRollouts = value.valueOptionsVariationRuleValues;
    this.ruleContentList = [];
    // 新创建的
    if(value.ruleJsonContent.length === 0) {
      this.ruleContentList.push({
        property: '',
        operation: '',
        value: '',
        multipleValue: []
      });
    } else {
      const segmentIds = value.ruleJsonContent.flatMap((item: IJsonContent) => {
        const isSegment = isSegmentRule(item);
        let ruleType: string = isSegment ? 'multi': ruleValueConfig.filter((rule: ruleType) => rule.value === item.operation)[0].type;

        let defaultValue: string;
        let multipleValue: string[];

        if(ruleType === 'multi') {
          multipleValue = JSON.parse(item.value || '[]');
          defaultValue = '';
        } else {
          defaultValue = item.value;
          multipleValue = [];
        }
        this.ruleContentList.push({
          property: item.property,
          operation: isSegment ? '': item.operation,
          value: defaultValue,
          multipleValue: [...multipleValue],
          type: ruleType
        });
        return isSegment? [...multipleValue] : [];
      })

      if (segmentIds.length > 0) {
        this.segmentService.getByIds(segmentIds).subscribe((segs: ISegment[]) => {
          this.segmentList = [...segs];
        });
      }
    }
  }

  @Input() userProps: IUserProp[] = [];

  @Output() deleteRule = new EventEmitter();
  @Output() updateRuleName = new EventEmitter<string>();
  @Output() percentageChange = new EventEmitter<{ serve:boolean, T: number, F: number }>();
  @Output() ruleConfigChange = new EventEmitter<IJsonContent[]>();

  public ruleContentList: IJsonContent[] = [];
  public ruleName: string = "";
  rulePercentageRollouts: IRulePercentageRollout[] = [];

  onAddRule() {
    this.ruleContentList.push({
      property: '',
      operation: '',
      value: '',
      multipleValue: []
    })
  }

  onDeleteRule() {
    this.deleteRule.emit();
  }

  public onDeleteRuleItem(index: number) {
    if(this.ruleContentList.length === 1) {
      this.ruleContentList[0] = {
        property: '',
        operation: '',
        value: '',
        multipleValue: []
      }
    } else {
      this.ruleContentList.splice(index, 1);
    }
    this.ruleConfigChange.next(this.ruleContentList);
  }

  public onRuleChange(value: IJsonContent, index: number) {
    const rule = { ...value, ...{multipleValue: [...value.multipleValue]} };
    if (isSegmentRule(rule)) {
      rule.operation = null;
    }

    this.ruleContentList = this.ruleContentList.map((item, idx) => idx === index ? rule : item);
    this.ruleConfigChange.next(this.ruleContentList);
  }

  public confirm() {
    this.onDeleteRule();
  }

  public onRuleNameChange() {
    this.updateRuleName.emit(this.ruleName);
  }

  canViewTargetedUsers(): boolean {
    const segmentProperties = [USER_IS_IN_SEGMENT, USER_IS_NOT_IN_SEGMENT];
    const segmentRules = this.ruleContentList.filter(x => segmentProperties.includes(x.property));
    return segmentRules.length === 0;
  }

  targetedUsersModalVisible: boolean = false;
  viewTargetedUsers() {
    this.targetedUsersModalVisible = true;
  }

  /**************Multi states */
  @Input() serveSingleOption: boolean = false;
  @Output() onPercentageChangeMultistates = new EventEmitter<IRulePercentageRollout[]>();
  @Input() variationOptions: IVariationOption[] = [];
}
