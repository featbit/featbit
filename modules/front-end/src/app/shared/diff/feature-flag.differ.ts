import { get, differenceBy, intersectionBy } from 'lodash-es';
import { Differ, IDiffer } from "@shared/diff/index";
import { IFeatureFlag, IVariationUser } from "@features/safe/feature-flags/types/details";
import { ICategory, IChange, IDiffVarationUser, IRefType, OperationEnum } from "@shared/diff/types";
import { getPercentageFromRolloutPercentageArray } from "@utils/index";
import { IUserType } from "@shared/types";
import { IVariation } from "@shared/rules";
import { ISegment } from "@features/safe/segments/types/segments-index";

export class FeatureFlagDiffer implements IDiffer {
  private primitiveConfig = [
    { label: $localize `:@@differ.name:name`, path: ['name'] },
    { label: $localize `:@@differ.description:description`, path: ['description'] },
  ];

  diff(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[] {
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

    if (ff1.disabledVariationId !== ff2.disabledVariationId) {
      specificChanges.push({
        label: $localize `:@@differ.the-return-value-when-flag-is-disabled:the return value when flag is disabled`,
        op: OperationEnum.UPDATE,
        isMultiValue: false,
        path: ['disabledVariationId'],
        value: ff2.variations.find((v) => v.id === ff2.disabledVariationId).value,
        oldValue: ff1.variations.find((v) => v.id === ff1.disabledVariationId).value
      });
    }

    // primitive changes
    const primitiveChanges: IChange[] = this.primitiveConfig.flatMap(({label, path}) => {
      return Differ.comparePrimitives(get(ff1, path), get(ff2, path), path)
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
      ...this.compareVariations(ff1, ff2),
      ...this.compareTags(ff1, ff2),
      ...this.compareFallthrough(ff1, ff2),
      ...this.compareTargetUsers(ff1, ff2, ref.targetingUsers),
      ...this.compareRules(ff1, ff2, ref.segments)
    ];
  }

  private compareTags(oldObj: IFeatureFlag, newObj: IFeatureFlag): ICategory[] {
    const path = ['tags'];
    let changes: ICategory[] = [];

    const addedTagChanges = differenceBy(newObj.tags, oldObj.tags, (tag) => tag).map((tag) => {
      return {
        op: OperationEnum.ADD,
        isMultiValue: false,
        path: path,
        value: tag
      }
    });

    const removedTagChanges = differenceBy(oldObj.tags, newObj.tags, (tag) => tag).map((tag) => {
      return {
        op: OperationEnum.REMOVE,
        isMultiValue: false,
        path: path,
        value: tag
      }
    });

    if (addedTagChanges.length > 0 || removedTagChanges.length > 0) {
      changes = [
        {
          label:  $localize `:@@differ.tags:Tags`,
          changes: [
            ...addedTagChanges,
            ...removedTagChanges
          ]
        }
      ]
    }

    return changes;
  }

  private compareVariations(oldObj: IFeatureFlag, newObj: IFeatureFlag): ICategory[] {
    const path = ['variations'];
    let changes: ICategory[] = [];

    const variationTypeChanges: IChange[] = [];
    if (oldObj.variationType !== newObj.variationType) {
      variationTypeChanges.push({
        label: $localize `:@@differ.variation-type:variation type`,
        op: OperationEnum.UPDATE,
        isMultiValue: false,
        path: ['variationType'],
        value: newObj.variationType,
        oldValue: oldObj.variationType
      });
    }

    const variationChanges = intersectionBy(newObj.variations, oldObj.variations, (variation) => variation.id).map((variation) => {
      const oldVariation = oldObj.variations.find((v) => v.id === variation.id);
      const newVariation = newObj.variations.find((v) => v.id === variation.id);

      if (oldVariation.value !== newVariation.value) {
        return {
          label: $localize `:@@differ.variation:variation`,
          op: OperationEnum.UPDATE,
          isMultiValue: false,
          path: path,
          value: newVariation.value,
          oldValue: oldVariation.value
        }
      }

      return null;
    }).filter((change) => change !== null);

    const addedVariationChanges = differenceBy(newObj.variations, oldObj.variations, (variation) => variation.id).map((variation) => {
      return {
        label: $localize `:@@differ.variation:variation`,
        op: OperationEnum.ADD,
        isMultiValue: false,
        path: path,
        value: variation.value
      }
    });

    const removedVariationChanges = differenceBy(oldObj.variations, newObj.variations, (variation) => variation.id).map((variation) => {
      return {
        label: $localize `:@@differ.variation:variation`,
        op: OperationEnum.REMOVE,
        isMultiValue: false,
        path: path,
        value: variation.value
      }
    });

    if (variationTypeChanges.length > 0 || variationChanges.length > 0 || addedVariationChanges.length > 0 || removedVariationChanges.length > 0) {
      changes = [
        {
          label:  $localize `:@@differ.variations:Variations`,
          changes: [
            ...variationTypeChanges,
            ...variationChanges,
            ...addedVariationChanges,
            ...removedVariationChanges
          ]
        }
      ]
    }

    return changes;
  }

  private compareRules(oldObj: IFeatureFlag, newObj: IFeatureFlag, segments: ISegment[]): ICategory[] {
    const path = ['rules'];
    let changes: ICategory[] = [];

    const ruleChanges = intersectionBy(newObj.rules, oldObj.rules, (rule) => rule.id).map((rule) => {
      const oldRule = oldObj.rules.find((r) => r.id === rule.id);
      const newRule = newObj.rules.find((r) => r.id === rule.id);

      if (JSON.stringify(oldRule) !== JSON.stringify(newRule)) {
        return {
          label: `${$localize `:@@differ.updated-rule:Updated rule:`} ${rule.name}`,
          op: OperationEnum.RULE,
          isMultiValue: false,
          path: path,
          value: {
            dispatchKey: newRule.dispatchKey,
            conditions: newRule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition, segments)),
            variations: newRule.variations.map((rv) => ({
              label: newObj.variations.find((v) => v.id === rv.id)?.value,
              percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
            }))
          }
        }
      }

      return null;
    }).filter((change) => change !== null);

    const addedRuleChanges = differenceBy(newObj.rules, oldObj.rules, (rule) => rule.id).map((rule) => {
      return {
        label: `${$localize `:@@differ.added-rule:Added rule:`} ${rule.name}`,
        op: OperationEnum.RULE,
        isMultiValue: false,
        path: path,
        value: {
          dispatchKey: rule.dispatchKey,
          conditions: rule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition, segments)),
          variations: rule.variations.map((rv) => ({
            label: newObj.variations.find((v) => v.id === rv.id)?.value,
            percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
          }))
        }
      }
    });

    const removedRuleChanges = differenceBy(oldObj.rules, newObj.rules, (rule) => rule.id).map((rule) => {
      return {
        label: `${$localize `:@@differ.removed-rule:Removed rule:`} ${rule.name}`,
        op: OperationEnum.RULE,
        isMultiValue: false,
        path: path,
        value: {
          dispatchKey: rule.dispatchKey,
          conditions: rule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition, segments)),
          variations: rule.variations.map((rv) => ({
            label: oldObj.variations.find((v) => v.id === rv.id)?.value,
            percentage: getPercentageFromRolloutPercentageArray(rv.rollout)
          }))
        }
      }
    });

    if (ruleChanges.length > 0 || addedRuleChanges.length > 0 || removedRuleChanges.length > 0) {
      changes = [
        {
          label:  $localize `:@@differ.rules:Rules`,
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
    const oldTargetUsers: IDiffVarationUser[] = this.mapVariationUserToDiffVarationUser(oldObj.targetUsers, oldObj.variations, users);
    const newTargetUsers: IDiffVarationUser[] = this.mapVariationUserToDiffVarationUser(newObj.targetUsers, newObj.variations, users);

    const changes = Differ.compareTargetUsers(oldTargetUsers, newTargetUsers, ['targetUsers']);
    if (changes.length > 0) {
      return [{
        label: $localize `:@@differ.target-users:Individual targeting`,
        changes: changes
      }];
    }

    return [];
  }

  private compareFallthrough(ff1: IFeatureFlag, ff2: IFeatureFlag): ICategory[] {
    const fallthroughPrimitivePaths = [
      { label: $localize `:@@differ.fallthrough-included-in-expt:Send to experiment`, path: ['fallthrough', 'includedInExpt']}
    ];

    const changes: IChange[] = fallthroughPrimitivePaths.flatMap(({label, path}) =>
      Differ.comparePrimitives(get(ff1, path), get(ff2, path), path)
        .map((change) => ({...change, label}))
    );

    const dispatchKeyPath = ['fallthrough', 'dispatchKey'];
    if (get(ff2, dispatchKeyPath) !== null) {
      const dispatchKeyChange = Differ.comparePrimitives(get(ff1, dispatchKeyPath), get(ff2, dispatchKeyPath), dispatchKeyPath)
        .map((change) => ({...change, label: $localize `:@@differ.dispatch-by:Dispatch by`}));

      if(dispatchKeyChange.length > 0) {
        changes.push(dispatchKeyChange[0]);
      }
    }

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

  private mapVariationUserToDiffVarationUser(variationUsers: IVariationUser[], variations: IVariation[], users: IUserType[]): IDiffVarationUser[] {
    return variations.map((variation) => {
      const variationUser = variationUsers.find((vu) => vu.variationId === variation.id);

      return {
        variationId: variation.id,
        variation: variation.value,
        users: variationUser === undefined ? [] : variationUser.keyIds.map((keyId) => {
          const user = users.find((user) => user.keyId === keyId);
          let name = keyId;

          if (user) {
            name = user.name?.length > 0
              ? `${user.name} (${user.keyId})`
              : user.keyId;
          }

          return { keyId, name };
        })
      }
    });
  }
}
