import { get, differenceBy, intersectionBy } from 'lodash-es';
import {Differ, IDiffer} from "@shared/diff/index";
import {ICategory, IChange, IDiffUser, IRefType, OperationEnum} from "@shared/diff/types";
import {ISegment} from "@features/safe/segments/types/segments-index";
import {IUserType} from "@shared/types";

export class SegmentDiffer implements IDiffer {
  private primitiveConfig = [
    { label: $localize `:@@differ.name:name`, path: ['name'] },
    { label: $localize `:@@differ.description:description`, path: ['description'] },
  ];

  diff(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[] {
    const segment1: ISegment = JSON.parse(obj1Str) as ISegment;
    const segment2: ISegment = JSON.parse(obj2Str) as ISegment;

    let changes: ICategory[] = [];

    let specificChanges:IChange[] = [];

    if (segment1.isArchived !== segment2.isArchived) {
      specificChanges.push({
        label: $localize `:@@differ.segment:segment`,
        op: segment2.isArchived ? OperationEnum.ARCHIVE : OperationEnum.UNARCHIVED,
        isMultiValue: false,
        path: ['isArchived'],
        value: segment2.isArchived,
        oldValue: segment1.isArchived
      });
    }

    // primitive changes
    const primitiveChanges: IChange[] = this.primitiveConfig.flatMap(({label, path}) => {
      return Differ.comparePrimitives(get(segment1, path), get(segment2, path), path)
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
      ...this.compareTargetUsers(segment1, segment2, ref.targetingUsers),
      ...this.compareRules(segment1, segment2)
    ];
  }

  private mapUserKeyIdsToUsers(keyIds: string[], users: IUserType[]): IDiffUser[] {
      return keyIds.map((keyId) => {
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

  private compareTargetUsers(oldObj: ISegment, newObj: ISegment, users: IUserType[]): ICategory[] {
    // included
    const oldIncluded = this.mapUserKeyIdsToUsers(oldObj.included, users);
    const newIncluded = this.mapUserKeyIdsToUsers(newObj.included, users);
    const includedChanges = this.compareUsers(oldIncluded, newIncluded, ['included'], $localize `:@@differ.included-targeting-users:Included targeting users`);

    // excluded
    const oldExcluded = this.mapUserKeyIdsToUsers(oldObj.excluded, users);
    const newExcluded = this.mapUserKeyIdsToUsers(newObj.excluded, users);
    const excludedChanges = this.compareUsers(oldExcluded, newExcluded, ['excluded'], $localize `:@@differ.excluded-targeting-users:Excluded targeting users`);

    const changes: IChange[] = [...includedChanges, ...excludedChanges];

    if (changes.length > 0) {
      return [{
        label: $localize `:@@differ.target-users:Individual targeting`,
        changes: changes
      }];
    }

    return [];
  }

  private compareUsers(oldUsers: IDiffUser[], newUsers: IDiffUser[], path: string[], changeLabel: string) {
    let changes: IChange[] = [];

    // added users
    const addedUsers = differenceBy(newUsers, oldUsers, (user) => user.keyId);
    if (addedUsers.length > 0) {
      changes.push({
        op: OperationEnum.ADD,
        label: changeLabel,
        isMultiValue: true,
        path: path,
        value: addedUsers.map((user) => user.name),
      })
    }

    // removed users
    const removedUsers = differenceBy(oldUsers, newUsers, (user) => user.keyId);
    if (removedUsers.length > 0) {
      changes.push({
        op: OperationEnum.REMOVE,
        label: changeLabel,
        isMultiValue: true,
        path: path,
        value: removedUsers.map((user) => user.name)
      })
    }

    return changes;
  }

  private compareRules(oldObj: ISegment, newObj: ISegment): ICategory[] {
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
            conditions: newRule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition))
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
          conditions: rule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition))
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
          conditions: rule.conditions.map((condition) => Differ.mapConditionToDiffCondition(condition))
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
}
