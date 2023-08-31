import { Component, EventEmitter, Input, Output, } from '@angular/core';
import { SegmentService } from '@services/segment.service';
import { isSegmentCondition, trackByFunction, uuidv4 } from '@utils/index';
import { IRuleOp, ruleOps } from './ruleConfig';
import { ISegment } from "@features/safe/segments/types/segments-index";
import { IRuleIdDispatchKey, IUserProp } from "@shared/types";
import {ICondition, IRule, IRuleVariation, IVariation} from "@shared/rules";

@Component({
  selector: 'find-rule',
  templateUrl: './find-rule.component.html',
  styleUrls: ['./find-rule.component.less']
})
export class FindRuleComponent {

  @Input() userProps: IUserProp[] = [];
  @Output() addProperty = new EventEmitter<IUserProp>();
  @Output() deleteRule = new EventEmitter<string>();
  @Output() updateRuleName = new EventEmitter<string>();
  @Output() onConditionChange = new EventEmitter<ICondition[]>();
  @Output() onDispatchKeyChange = new EventEmitter<IRuleIdDispatchKey>();

  conditions: ICondition[] = [];
  name: string = "";
  id: string = "";
  dispatchKey: string = "";
  variations: IRuleVariation[] = [];
  trackByFunction = trackByFunction;

  segmentList: ISegment[] = [];

  constructor(
    private segmentService: SegmentService
  ) { }

  @Input()
  set data(value: IRule) {
    this.id = value.id;
    this.name = value.name;
    this.dispatchKey = value.dispatchKey;
    this.variations = value.variations || [];
    this.conditions = [];

    if(value.conditions.length === 0) {
      this.conditions.push({
        id: uuidv4(),
        property: '',
        op: '',
        value: '',
        multipleValue: []
      } as ICondition);
    } else {
      const segmentIds = value.conditions.flatMap((item: ICondition) => {
        const isSegment = isSegmentCondition(item.property);
        let opType: string = isSegment ? 'multi': ruleOps.filter((op: IRuleOp) => op.value === item.op)[0].type;

        let defaultValue: string;
        let multipleValue: string[];

        if(opType === 'multi') {
          multipleValue = JSON.parse(item.value || '[]');
          defaultValue = '';
        } else {
          defaultValue = item.value;
          multipleValue = [];
        }
        this.conditions.push({
          id: item.id,
          property: item.property,
          op: isSegment ? '': item.op,
          value: defaultValue,
          multipleValue: [...multipleValue],
          type: opType
        } as ICondition);
        return isSegment? [...multipleValue] : [];
      })

      if (segmentIds.length > 0) {
        this.segmentService.getByIds(segmentIds).subscribe((segs: ISegment[]) => {
          this.segmentList = [...segs];
        });
      }
    }
  }

  onAddRule() {
    this.conditions.push({
      id: uuidv4(),
      property: '',
      op: '',
      value: '',
      multipleValue: []
    } as ICondition)
  }

  onAddProperty(prop: IUserProp) {
    this.addProperty.emit(prop);
  }

  onDeleteRule() {
    this.deleteRule.emit(this.id);
  }

  onDeleteRuleItem(index: number) {
    if(this.conditions.length === 1) {
      this.conditions[0] = {
        id: uuidv4(),
        property: '',
        op: '',
        value: '',
        multipleValue: []
      } as ICondition
    } else {
      this.conditions.splice(index, 1);
    }
    this.onConditionChange.next(this.conditions);
  }

  onRuleChange(value: ICondition, index: number) {
    const rule = { ...value, ...{multipleValue: [...value.multipleValue]} };
    if (isSegmentCondition(rule.property)) {
      rule.op = null;
    }

    this.conditions = this.conditions.map((item, idx) => idx === index ? rule : item);
    this.onConditionChange.next(this.conditions);
  }

  dispatchKeyChange(dispatchKey: string) {
    this.onDispatchKeyChange.emit({ ruleId: this.id, dispatchKey: dispatchKey });
  }

  onRuleNameChange() {
    this.updateRuleName.emit(this.name);
  }

  @Output() onServeChange = new EventEmitter<IRuleVariation[]>();
  @Input() variationOptions: IVariation[] = [];
}
