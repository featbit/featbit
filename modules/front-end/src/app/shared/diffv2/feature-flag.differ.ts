import _ from 'lodash';
import {Differ, IDiffer} from "@shared/diffv2/index";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IChange, OperationEnum} from "@shared/diffv2/types";

export class FeatureFlagDiffer implements IDiffer {
  private differ: Differ;
  private paths = [
    // { label: $localize `:@@differ.`, path: ['isArchived'] },
    // ['isEnabled'],
    ['key'],
    ['name'],
    ['variationType'],
  ];

  constructor() {
    this.differ = new Differ();
  }

  diff(obj1Str: string, obj2Str: string): IChange[] {
    const ff1: IFeatureFlag = {
      name: 'flag1'
    } as IFeatureFlag;//JSON.parse(obj1Str) as IFeatureFlag;
    const ff2: IFeatureFlag = {
      name: 'flag1-1'
    } as IFeatureFlag;//JSON.parse(obj2Str) as IFeatureFlag;

    const changes:IChange[] = [];
    // specific changes
    // if (ff1.isArchived !== ff2.isArchived) {
    //   changes.push({
    //     op: OperationEnum.UPDATE,
    //     path: ['isArchived'],
    //     oldValue: ff1.isArchived,
    //     value: ff2.isArchived,
    //   });
    // }
    // if (ff1.isEnabled !== ff2.isEnabled) {
    //   changes.push({
    //     op: OperationEnum.UPDATE,
    //     path: ['isEnabled'],
    //     oldValue: ff1.isArchived,
    //     value: ff2.isArchived,
    //   });
    // }

    return this.paths.flatMap((path) => this.differ.compare(_.get(ff1, path), _.get(ff2, path), []));
  }

  // private compare(obj1: IFeatureFlag, obj2: IFeatureFlag): IChange[] {
  //   return this.differ.compare(obj1, obj2, []);
  // }
}
