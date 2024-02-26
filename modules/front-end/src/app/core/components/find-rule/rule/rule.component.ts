import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { isSegmentCondition, uuidv4 } from '@utils/index';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { findIndex, IRuleOp, ruleOps } from '../ruleConfig';
import { ISegment, ISegmentListModel, SegmentListFilter } from '@features/safe/segments/types/segments-index';
import { SegmentService } from '@services/segment.service';
import { IUserProp } from "@shared/types";
import { ICondition } from "@shared/rules";

@Component({
  selector: 'app-rule',
  templateUrl: './rule.component.html',
  styleUrls: ['./rule.component.less']
})
export class RuleComponent {

  private inputs = new Subject<any>();

  @Input('segmentList')
  set segmentList(data: ISegment[]) {
    this.segments = [...data];
  }

  public compareWith: (obj1: {id: string}, obj2: {id: string}) => boolean = (obj1: {id: string}, obj2: {id: string}) => {
    if(obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input() isFirst: boolean;
  @Input() isLast: boolean;

  @Input("condition")
  set content(data: ICondition) {
    this.isSegmentRule = isSegmentCondition(data.property);
    this.condition = { ...data };
  }

  isSegmentRule: boolean = false;
  condition: ICondition;

  selectedProp: IUserProp;

  @Input("userProps")
  set properties(data: IUserProp[]) {
    this.userProps = data;
    this.filteredProps = [...data];
    this.selectedProp = this.userProps.find(prop => prop.name === this.condition.property);
  }

  userProps: IUserProp[] = [];
  filteredProps: IUserProp[] = [];

  get currentUserProp(): IUserProp {
    const userProp = this.userProps.find(prop => prop.name === this.condition.property);
    if (!userProp) {
      return {
        id: uuidv4(),
        name: "",
        presetValues: [],
        isBuiltIn: false,
        usePresetValuesOnly: false,
        isDigestField: false,
        remark: '',
        isNew: true
      };
    }

    // adapt to existing value that preset values don't contain
    if (userProp.usePresetValuesOnly) {
      if (this.condition.value && userProp.presetValues.findIndex(x => x.value === this.condition.value) === -1) {
        userProp.presetValues.push({
          id: '',
          value: this.condition.value,
          description: this.condition.value
        })
      }

      if (this.condition.multipleValue) {
        this.condition.multipleValue.forEach(value => {
          if (userProp.presetValues.findIndex(x => x.value === value) === -1) {
            userProp.presetValues.push({
              id: '',
              value: value,
              description: value
            })
          }
        });
      }
    }

    return userProp;
  }

  get multiSelectMode(): 'multiple' | 'tags' {
    return this.currentUserProp.usePresetValuesOnly ? 'multiple' : 'tags';
  }

  @Output() addProperty = new EventEmitter();
  @Output() addRule = new EventEmitter<IUserProp>();
  @Output() deleteRule = new EventEmitter();
  @Output() ruleChange = new EventEmitter<ICondition>();

  public ruleValueConfig: IRuleOp[] = [];

  constructor(private segmentService: SegmentService, private cdr: ChangeDetectorRef) {
    this.ruleValueConfig = ruleOps;
    this.inputs.pipe(
      debounceTime(500)
    ).subscribe(e => {
      if (this.isSegmentRule) {
        this.loadSegmentList(e);
      } else {
        this.ruleChange.next(e);
      }
    })
  }

  isLoadingSegments = false;
  segments: ISegment[] = [];
  loadSegmentList(query: string) {
    this.isLoadingSegments = true;
    this.segmentService
      .getSegmentList(new SegmentListFilter(query))
      .subscribe((segments: ISegmentListModel) => {
        this.segments = segments.items;
        this.isLoadingSegments = false;
      });
  }

  onSearchSegments(value: string = '') {
    this.isLoadingSegments = true;
    this.inputs.next(value);
  }

  onOperationChange() {
    let result = findIndex(this.condition.op);
    this.condition.type = this.ruleValueConfig[result].type;
    this.condition.value = this.ruleValueConfig[result].default;

    this.ruleChange.next(this.condition);
  }

  onRemoveMultiValue(val) {
    this.condition.multipleValue = this.condition.multipleValue.filter(v => v !== val);
    this.ruleChange.next(this.condition);
    this.cdr.detectChanges();
  }

  public onSearchProperty(value: string = '') {
    const find = this.userProps.find((p) => p.name === value);
    const props = this.userProps.filter((p) => p.name.toLowerCase().startsWith(value.toLowerCase()));

    if (!find && value?.length > 0) {
      const newProp: IUserProp = {
        id: uuidv4(),
        name: value,
        presetValues: [],
        isBuiltIn: false,
        usePresetValuesOnly: false,
        isDigestField: false,
        remark: '',

        isNew: true
      };

      this.filteredProps = [
        ...props,
        newProp
      ];
    } else {
      this.filteredProps = [
        ...props
      ];
    }
  }

  public onPropertyChange() {
    if (this.selectedProp.isNew) {
      this.addProperty.emit({ ...this.selectedProp, isNew: false });
    }

    this.condition.property = this.selectedProp.name;
    this.isSegmentRule = isSegmentCondition(this.condition.property);

    let result = findIndex(this.condition.op);
    this.condition.value = this.ruleValueConfig[result]?.default;
    this.condition.multipleValue = [];

    if (this.isSegmentRule) {
      this.condition.type = 'multi';
    } else {
      this.condition.type = this.ruleValueConfig[result]?.type;
    }

    this.onModelChange();
  }

  public onModelChange() {
    this.ruleChange.next(this.condition);
    this.onDebounceTimeModelChange();
  }

  public onDebounceTimeModelChange() {
    this.inputs.next(this.condition);
  }

  getValueDescription(value: string): string {
    let description = this.isSegmentRule
      ? this.segments.find(x => x.id === value)?.name
      : this.currentUserProp.presetValues?.find(x => x.value === value)?.description;

    return description ?? value;
  }
}
