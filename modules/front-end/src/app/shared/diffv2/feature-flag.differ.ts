import _ from 'lodash';
import {Differ, IDiffer} from "@shared/diffv2/index";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IChange, OperationEnum} from "@shared/diffv2/types";

export class FeatureFlagDiffer implements IDiffer {

  private paths = [
    // { label: $localize `:@@differ.is-archived:is archived.`, path: ['isArchived'] },
    // { label: $localize `:@@differ.name:name`, path: ['name'] },
    // { label: $localize `:@@differ.status:status`, path: ['isEnabled'] },
    // ['isEnabled'],
    // ['variationType'],
    // ['disabledVariationId'],
    { label: $localize `:@@differ.fallthrough:Default rule`, path: ['fallthrough', 'variations'] },
  ];


  constructor() {
  }

  getChangeList(obj1Str: string, obj2Str: string): IChange[] {
    const diff = this.diff(obj1Str, obj2Str);
    return diff;
  }
  diff(obj1Str: string, obj2Str: string): IChange[] {
    const ff1: IFeatureFlag = {
      name: 'flag1',
      key: 'key1',
      isEnabled: false,
      disabledVariationId: 'd52c48a8-289e-4a23-8399-33100b1b139e',
      fallthrough: {
        includedInExpt: true,
        variations: [{
          exptRollout: 1,
          id: 'b6469b5b-3e69-4cfd-8929-849229a1f923',
          rollout: [0, 1]
        }]
      }
    } as IFeatureFlag;
    const ff2: IFeatureFlag = {
      name: 'flag1-1',
      key: 'key2',
      isEnabled: true,
      disabledVariationId: 'b6469b5b-3e69-4cfd-8929-849229a1f923',
      fallthrough: {
        includedInExpt: true,
        variations: [{
          exptRollout: 1,
          id: 'd52c48a8-289e-4a23-8399-33100b1b139e',
          rollout: [0, 1]
        }]
      }
    } as IFeatureFlag;

    /*const ff1: IFeatureFlag = JSON.parse(obj1Str) as IFeatureFlag;
    const ff2: IFeatureFlag = JSON.parse(obj2Str) as IFeatureFlag;*/
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

    return this.paths.flatMap(({label, path}) => Differ.compare(_.get(ff1, path), _.get(ff2, path), path).map((change) => ({...change, label})));
  }

  // private compare(obj1: IFeatureFlag, obj2: IFeatureFlag): IChange[] {
  //   return this.differ.compare(obj1, obj2, []);
  // }
}
