import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { isSegmentRule } from '@shared/utils';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IJsonContent } from "@features/safe/switch-manage/types/switch-new";
import { ruleType, ruleValueConfig, findIndex } from '../ruleConfig';
import { ISegment, ISegmentListModel, SegmentListFilter } from '@features/safe/segments/types/segments-index';
import { SegmentService } from '@services/segment.service';
import { IUserProp } from "@shared/types";

@Component({
  selector: 'app-rule',
  templateUrl: './rule.component.html',
  styleUrls: ['./rule.component.less']
})
export class RuleComponent  {

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

  @Input("ruleContent")
  set content(data: IJsonContent) {
    this.isSegmentRule = isSegmentRule(data);
    this.ruleContent = { ...data };
  }

  isSegmentRule: boolean = false;
  ruleContent: IJsonContent;

  @Input() userProps: IUserProp[];
  get currentUserProp(): IUserProp {
    const userProp = this.userProps.find(prop => prop.name === this.ruleContent.property);

    // adapt to existing value that preset values don't contain
    if (userProp.usePresetValuesOnly) {
      if (this.ruleContent.value && userProp.presetValues.findIndex(x => x.value === this.ruleContent.value) === -1) {
        userProp.presetValues.push({
          id: '',
          value: this.ruleContent.value,
          description: this.ruleContent.value
        })
      }

      if (this.ruleContent.multipleValue) {
        this.ruleContent.multipleValue.forEach(value => {
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

  @Output() addRule = new EventEmitter();                           // 添加条件
  @Output() deleteRule = new EventEmitter();                        // 删除条件
  @Output() ruleChange = new EventEmitter<IJsonContent>();       // 刷新数据

  public ruleValueConfig: ruleType[] = [];

  constructor(private segmentService: SegmentService, private cdr: ChangeDetectorRef) {
    this.ruleValueConfig = ruleValueConfig;
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

  onSearchSegments(value: string = ''){
    this.isLoadingSegments = true;
    this.inputs.next(value);
  }

  onOperationChange() {
    let result = findIndex(this.ruleContent.operation);
    this.ruleContent.type = this.ruleValueConfig[result].type;
    this.ruleContent.value = this.ruleValueConfig[result].default;

    this.ruleChange.next(this.ruleContent);
  }

  onRemoveMultiValue(val) {
    this.ruleContent.multipleValue = this.ruleContent.multipleValue.filter(v => v !== val);
    this.ruleChange.next(this.ruleContent);
    this.cdr.detectChanges();
  }

  public onPropertyChange() {
    this.isSegmentRule = isSegmentRule(this.ruleContent);

    let result = findIndex(this.ruleContent.operation);
    this.ruleContent.value = this.ruleValueConfig[result]?.default;
    this.ruleContent.multipleValue = [];

    if (this.isSegmentRule) {
      this.ruleContent.type = 'multi';
    } else {
      this.ruleContent.type = this.ruleValueConfig[result]?.type;
    }

    this.onModelChange();
  }

  // 数据改变，触发数据刷新
  public onModelChange() {
    this.ruleChange.next(this.ruleContent);
    this.onDebounceTimeModelChange();
  }

  // 需要节流的数据
  public onDebounceTimeModelChange() {
    this.inputs.next(this.ruleContent);
  }

  getValueDescription(value: string): string {
    let description = this.isSegmentRule
      ? this.segments.find(x => x.id === value)?.name
      : this.currentUserProp.presetValues?.find(x => x.value === value)?.description;

    return description ?? value;
  }
}
