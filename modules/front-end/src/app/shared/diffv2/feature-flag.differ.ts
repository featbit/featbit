import _ from 'lodash';
import {Differ, IDiffer} from "@shared/diffv2/index";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {ICategory, IChange, IDiffVarationUser, IRefType, OperationEnum} from "@shared/diffv2/types";
import {getPercentageFromRolloutPercentageArray, isSegmentCondition} from "@utils/index";
import {IUserType} from "@shared/types";
import {ICondition} from "@shared/rules";
import {findIndex, ruleOps} from "@core/components/find-rule/ruleConfig";
import {ISegment} from "@features/safe/segments/types/segments-index";

export class FeatureFlagDiffer implements IDiffer {

  private primitiveConfig = [
    { label: $localize `:@@differ.name:name`, path: ['name'] },
  ];

  constructor() {
  }

  getChangeList(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[] {
    const diff = this.diff(obj1Str, obj2Str, ref);
    return diff;
  }

  diff(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[] {
    // const ff1: IFeatureFlag = {
    //   name: 'flag1',
    //   key: 'key1',
    //   isEnabled: true,
    //   isArchived: true,
    //   disabledVariationId: 'd52c48a8-289e-4a23-8399-33100b1b139e',
    //   fallthrough: {
    //     includedInExpt: true,
    //     variations: [{
    //       exptRollout: 1,
    //       id: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //       rollout: [0, 1]
    //     }]
    //   },
    //   targetUsers: [
    //     {
    //       variationId: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //       keyIds: ['u1','u2','u3']
    //     },
    //     {
    //       variationId: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //       keyIds: ['u4','u5']
    //     }
    //   ],
    //   rules: [
    //     {
    //       name: 'Rule 1',
    //       id: 'fa64ed8f-1f8e-445c-be73-7a17189a83ea',
    //       includedInExpt: false,
    //       conditions: [
    //         {
    //           op: 'IsTrue',
    //           property: 'keyId',
    //           value: 'IsTrue'
    //         },
    //         {
    //           op: 'IsOneOf',
    //           property: 'keyId',
    //           value: '[\"abc\",\"def\"]'
    //         },
    //         {
    //           op: null,
    //           property: 'User is in segment',
    //           value: "[\"0cb16508-a5f7-4f56-97b3-af7900a6399e\"]"
    //         }
    //       ],
    //       variations: [
    //         {
    //           exptRollout: 1,
    //           id: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //           rollout: [0, 0.2]
    //         },
    //         {
    //           exptRollout: 1,
    //           id: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //           rollout: [0, 0.8]
    //         }
    //       ]
    //     },
    //     {
    //       name: 'Rule 3',
    //       id: 'fa64ed8f-1f8e-445c-be73-7a17189a83eb',
    //       includedInExpt: false,
    //       conditions: [
    //         {
    //           op: 'IsFalse',
    //           property: 'keyId',
    //           value: 'IsTrue'
    //         }
    //       ],
    //       variations: [
    //         {
    //           exptRollout: 1,
    //           id: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //           rollout: [0, 0.5]
    //         },
    //         {
    //           exptRollout: 1,
    //           id: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //           rollout: [0, 0.5]
    //         }
    //       ]
    //     },
    //   ],
    //   variations: [
    //     {id: "d489bd96-a16a-4774-b00a-51defe5ad332", value: "true"},
    //     {id: "a669a3b4-7d02-436b-91f9-0faf541f3fb6", value: "false"}
    //   ]
    // } as IFeatureFlag;
    // const ff2: IFeatureFlag = {
    //   name: 'flag1-1',
    //   key: 'key2',
    //   isEnabled: false,
    //   isArchived: false,
    //   disabledVariationId: 'b6469b5b-3e69-4cfd-8929-849229a1f923',
    //   fallthrough: {
    //     includedInExpt: false,
    //     variations: [
    //       {
    //         exptRollout: 0.3,
    //         id: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //         rollout: [0, 0.6]
    //       },
    //       {
    //         exptRollout: 0.4,
    //         id: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //         rollout: [0, 0.4]
    //       }]
    //   },
    //   targetUsers: [
    //     {
    //       variationId: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //       keyIds: ['u1']
    //     },
    //     {
    //       variationId: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //       keyIds: ['u2', 'u3', 'u4','u5']
    //     }
    //   ],
    //   rules: [
    //     {
    //       name: 'Rule 3',
    //       id: 'fa64ed8f-1f8e-445c-be73-7a17189a83eb',
    //       includedInExpt: false,
    //       conditions: [
    //         {
    //           op: 'IsTrue',
    //           property: 'keyId',
    //           value: 'IsTrue'
    //         }
    //       ],
    //       variations: [
    //         {
    //           exptRollout: 1,
    //           id: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //           rollout: [0, 0.5]
    //         },
    //         {
    //           exptRollout: 1,
    //           id: 'a669a3b4-7d02-436b-91f9-0faf541f3fb6',
    //           rollout: [0, 0.5]
    //         }
    //       ]
    //     },
    //     {
    //       name: 'Rule 2',
    //       id: 'fa64ed8f-1f8e-445c-be73-7a17189a83ec',
    //       includedInExpt: false,
    //       conditions: [
    //         {
    //           op: 'IsTrue',
    //           property: 'keyId',
    //           value: 'IsTrue'
    //         },
    //         {
    //           op: 'IsOneOf',
    //           property: 'keyId',
    //           value: '[\"abc\",\"def\"]'
    //         },
    //         {
    //           op: null,
    //           property: 'User is in segment',
    //           value: "[\"0cb16508-a5f7-4f56-97b3-af7900a6399e\"]"
    //         }
    //       ],
    //       variations: [
    //         {
    //           exptRollout: 1,
    //           id: 'd489bd96-a16a-4774-b00a-51defe5ad332',
    //           rollout: [0, 1]
    //         }
    //       ]
    //     }
    //   ],
    //   variations: [
    //     {id: "d489bd96-a16a-4774-b00a-51defe5ad332", value: "true"},
    //     {id: "a669a3b4-7d02-436b-91f9-0faf541f3fb6", value: "false"}
    //   ]
    // } as IFeatureFlag;

    const ff1: IFeatureFlag = JSON.parse(obj1Str) as IFeatureFlag;
    const ff2: IFeatureFlag = JSON.parse(obj2Str) as IFeatureFlag;

    let changes: ICategory[] = [];

    let specificChanges:IChange[] = [];
    // specific changes
    if (ff1.isEnabled !== ff2.isEnabled) {
      specificChanges.push({
        label: $localize `:@@differ.feature-flag:feature flag`,
        op: ff2.isEnabled ? OperationEnum.ENABLE : OperationEnum.DISABLE,
        isMultiValue: false,
        path: ['isEnabled'],
        value: ff2.isEnabled,
        oldValue: ff1.isEnabled
      });
    }

    if (ff1.isArchived !== ff2.isArchived) {
      specificChanges.push({
        label: $localize `:@@differ.feature-flag:feature flag`,
        op: ff2.isArchived ? OperationEnum.ARCHIVE : OperationEnum.UNARCHIVED,
        isMultiValue: false,
        path: ['isEnabled'],
        value: ff2.isArchived,
        oldValue: ff1.isArchived
      });
    }

    // primitive changes
    const primitiveChanges: IChange[] = this.primitiveConfig.flatMap(({label, path}) => {
      return Differ.comparePrimitives(_.get(ff1, path), _.get(ff2, path), path)
        .map((change) => ({...change, label}));
    });

    if (specificChanges.length > 0 || primitiveChanges.length > 0) {
      changes.push({
        label: $localize `:@@differ.settings:Settings`,
        changes: [...specificChanges, ...primitiveChanges]
      });
    }

    return [
      ...changes,
      ...this.compareFallthrough(ff1, ff2), // fallthrough
      ...this.compareTargetUsers(ff1, ff2, ref.targetingUsers), // targetUsers
      ...this.compareRules(ff1, ff2, ref.segments) // rules
    ];
  }

  private mapConditionToDiffCondition(condition: ICondition, segments: ISegment[]) {
    const isSegment = isSegmentCondition(condition);

    if (!isSegment) {
      const ruleOpIdx = findIndex(condition.op);
      const isMultiValue = ruleOps[ruleOpIdx].type === 'multi';

      return {
        property: condition.property,
        op: condition.op,
        opLabel: ruleOps[ruleOpIdx].label,
        value: isMultiValue ? JSON.parse(condition.value) : condition.value,
        isMultiValue
      }
    } else {
      return {
        property: condition.property,
        op: null,
        value: JSON.parse(condition.value).map((segmentId) => segments.find((s) => s.id === segmentId)?.name ?? segmentId),
        isMultiValue: true
      }
    }
  }

  private compareRules(oldObj: IFeatureFlag, newObj: IFeatureFlag, segments: ISegment[]): ICategory[] {
    const path = ['rules'];
    let changes: ICategory[] = [];

    const ruleChanges = _.intersectionBy(newObj.rules, oldObj.rules, (rule) => rule.id).map((rule) => {
      const oldRule = oldObj.rules.find((r) => r.id === rule.id);
      const newRule = newObj.rules.find((r) => r.id === rule.id);

      if (JSON.stringify(oldRule) !== JSON.stringify(newRule)) {
        return {
          label: `${$localize `:@@differ.updated-rule:Updated rule:`} ${rule.name}`,
          op: OperationEnum.RULE,
          isMultiValue: false,
          path: path,
          value: {
            conditions: newRule.conditions.map((condition) => this.mapConditionToDiffCondition(condition, segments)),
            variations: newRule.variations.map((rv) => ({
              label: newObj.variations.find((v) => v.id === rv.id)?.value,
              percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
            }))
          }
        }
      }
    });

    const addedRuleChanges = _.differenceBy(newObj.rules, oldObj.rules, (rule) => rule.id).map((rule) => {
      return {
        label: `${$localize `:@@differ.added-rule:Added rule:`} ${rule.name}`,
        op: OperationEnum.RULE,
        isMultiValue: false,
        path: path,
        value: {
          conditions: rule.conditions.map((condition) => this.mapConditionToDiffCondition(condition, segments)),
          variations: rule.variations.map((rv) => ({
            label: newObj.variations.find((v) => v.id === rv.id)?.value,
            percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
          }))
        }
      }
    });

    const removedRuleChanges = _.differenceBy(oldObj.rules, newObj.rules, (rule) => rule.id).map((rule) => {
      return {
        label: `${$localize `:@@differ.removed-rule:Removed rule:`} ${rule.name}`,
        op: OperationEnum.RULE,
        isMultiValue: false,
        path: path,
        value: {
          conditions: rule.conditions.map((condition) => this.mapConditionToDiffCondition(condition, segments)),
          variations: rule.variations.map((rv) => ({
            label: oldObj.variations.find((v) => v.id === rv.id)?.value,
            percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
          }))
        }
      }
    });

    if (addedRuleChanges.length > 0 || removedRuleChanges.length > 0) {
      changes = [
        {
          label:  $localize `:@@differ.rules:Rules:`,
          changes: [
            ...ruleChanges,
            ...addedRuleChanges,
            ...removedRuleChanges
          ]
        }
      ]
    }

    return changes;
  }

  private compareTargetUsers(oldObj: IFeatureFlag, newObj: IFeatureFlag, users: IUserType[]): ICategory[] {
    const oldTargetUsers: IDiffVarationUser[] = Differ.mapVariationUserToDiffVarationUser(oldObj.targetUsers, oldObj.variations, users);
    const newTargetUsers: IDiffVarationUser[] = Differ.mapVariationUserToDiffVarationUser(newObj.targetUsers, newObj.variations, users);

    const changes = Differ.compareTargetUsers(oldTargetUsers, newTargetUsers, ['targetUsers']);
    if (changes.length > 0) {
      return [{
        label: $localize `:@@differ.target-users:Individual targeting`,
        changes: changes
      }];
    }
  }

  private compareFallthrough(ff1: IFeatureFlag, ff2: IFeatureFlag): ICategory[] {
    const fallthroughPrimitivePaths = [{ label: 'includedInExpt', path: ['fallthrough', 'includedInExpt']}];

    const changes: IChange[] = fallthroughPrimitivePaths.flatMap(({label, path}) =>
      Differ.comparePrimitives(_.get(ff1, path), _.get(ff2, path), path)
        .map((change) => ({...change, label}))
    );

    const oldVariations = ff1.fallthrough.variations.map((rv) => ({
      ...rv,
      percentage: getPercentageFromRolloutPercentageArray(rv['rollout']),
      label: ff1.variations.find((v => v.id === rv.id))?.value
    }));
    const newVariations = ff2.fallthrough.variations.map((rv) => ({
      ...rv,
      percentage: getPercentageFromRolloutPercentageArray(rv['rollout']),
      label: ff2.variations.find((v => v.id === rv.id))?.value
    }));

    const variationChange = Differ.compareRuleVariations(oldVariations, newVariations, ['fallthrough', 'variations'])
    if (variationChange) {
      changes.push(variationChange);
    }

    if (changes.length > 0) {
     return [{
        label: $localize `:@@differ.fallthrough:Default rule`,
        changes: changes
      }];
    }

    return [];
  }
}
