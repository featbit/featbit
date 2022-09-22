import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IFfpParams, IPrequisiteFeatureFlag, IVariationOption } from '../../types/switch-new';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'upper-switch',
  templateUrl: './upper-switch.component.html',
  styleUrls: ['./upper-switch.component.less']
})
export class UpperSwitchComponent {

  private searchSubject = new Subject<any>();
  public compareWithPrequisiteFeatureFlag: (obj1: IPrequisiteFeatureFlag, obj2: IPrequisiteFeatureFlag) => boolean = (obj1: IPrequisiteFeatureFlag, obj2: IPrequisiteFeatureFlag) => {
    if(obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  public compareWithVariationOption: (obj1: IVariationOption, obj2: IVariationOption) => boolean = (obj1: IVariationOption, obj2: IVariationOption) => {
    if(obj1 && obj2) {
      return obj1.localId === obj2.localId;
    } else {
      return false;
    }
  };

  @Input("featureList")
  set list(data: IPrequisiteFeatureFlag[]) {
    this.isLoading = false;
    this.upperFeatures.forEach(u => {
      u.selectedFeatureFlag = data.find(d => d.id === u.prerequisiteFeatureFlagId);
    });
    this.featureList = [...data];
  }

  @Input("upperFeatures")
  set data(value: IFfpParams[]){
    this.upperFeatures = [...value];
    this.sortoutSelectedID();
  };

  public isLoading = false;
  public featureList: IPrequisiteFeatureFlag[] = [];
  public selectedFeatureFlagIDs: string[] = [];
  public upperFeatures: IFfpParams[] = [];

  constructor() {
    this.searchSubject.pipe(
      debounceTime(100),
      //distinctUntilChanged()
    ).subscribe(e => {
      this.search.next(e);
    });
  }

  public onSearch(value: string = '') {
    this.isLoading = true;
    this.searchSubject.next(value);
  }

  @Output() search = new EventEmitter<string>();
  @Output() onUpperSwicthChange = new EventEmitter<IFfpParams[]>();         // 修改设置

  // 添加上游开关
  onAddUpperSwitch(event) {
    event.stopPropagation()
    this.upperFeatures = [
      ...this.upperFeatures,
      {
      prerequisiteFeatureFlagId: null,
      selectedFeatureFlag: null,
      valueOptionsVariationValue: null
    }];
    // this.upperFeatures.push({
    //   prerequisiteFeatureFlagId: null,
    //   selectedFeatureFlag: null,
    //   valueOptionsVariationValue: null
    // });
  }

  // 删除开关
  onDeleteSwitch(index: number) {
    this.upperFeatures.splice(index, 1);
    this.sortoutSelectedID();
    this.onOutputResult();
  }

  onSelectChange(currentUpperFeature: IFfpParams, selectedOption: IPrequisiteFeatureFlag) {
    this.sortoutSelectedID();
    currentUpperFeature.prerequisiteFeatureFlagId = selectedOption.id;
    currentUpperFeature.selectedFeatureFlag = Object.assign({}, selectedOption);
    currentUpperFeature.valueOptionsVariationValue = null;
  }

  // 数据发生改变
  public onVariationValueChange() {
    this.onOutputResult();
  }

  private onOutputResult() {
    this.onUpperSwicthChange.next(this.upperFeatures);
  }

  // 筛选选中的开关 ID
  private sortoutSelectedID(): void {
    this.selectedFeatureFlagIDs = [...this.upperFeatures.map(item => item.prerequisiteFeatureFlagId)];
  }
}
