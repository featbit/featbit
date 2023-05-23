import { keyBy, differenceBy } from 'lodash-es';

import {
  ICategory,
  IChange,
  IDiffVarationUser,
  IRefType,
  ObjectType,
  OperationEnum,
  PrimitiveType
} from "@shared/diff/types";
import {ICondition, IRuleVariation} from "@shared/rules";
import {ISegment} from "@features/safe/segments/types/segments-index";
import {isSegmentCondition} from "@utils/index";
import {findIndex, ruleOps} from "@core/components/find-rule/ruleConfig";

export interface IDiffer {
  diff(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[]
}


export abstract class Differ {

  static comparePrimitives (oldObj: PrimitiveType, newObj: PrimitiveType, path: string[]): IChange[] {
    const changes: IChange[] = [];
    if (oldObj !== newObj) {
      changes.push({
        op: OperationEnum.UPDATE,
        isMultiValue: false,
        path: path,
        value: newObj,
        oldValue: oldObj
      });
    }
    return changes;
  }

  static compareTargetUsers(oldVariationUsers: IDiffVarationUser[], newVariationUsers: IDiffVarationUser[], path: string[]): IChange[] {
    let changes: IChange[] = [];

    const oldIndexedObj: ObjectType = this.convertArrayToObj(oldVariationUsers, 'variationId');

    newVariationUsers.map((vu) => {
      const oldUsers = oldIndexedObj[vu.variationId]?.users ?? [];

      // added users
      const addedUsers = differenceBy(vu.users, oldUsers, (user) => user.keyId);
      if (addedUsers.length > 0) {
        changes.push({
          op: OperationEnum.ADD,
          label: vu.variation,
          isMultiValue: true,
          path: [...path, vu.variationId],
          value: addedUsers.map((user) => user.name),
        })
      }

      // removed users
      const removedUsers = differenceBy(oldUsers, vu.users, (user) => user.keyId);
      if (removedUsers.length > 0) {
        changes.push({
          op: OperationEnum.REMOVE,
          label: vu.variation,
          isMultiValue: true,
          path: [...path, vu.variationId],
          value: removedUsers.map((user) => user.name)
        })
      }
    });

    return changes;
  }

  static compareRuleVariations(oldVariations: IRuleVariation[], newVariations: IRuleVariation[], path: string[]): IChange | null {
    const oldIndexedObj: ObjectType = this.convertArrayToObj(oldVariations, 'id');
    const newIndexedObj: ObjectType = this.convertArrayToObj(newVariations, 'id');

    if (
      oldVariations.length !== newVariations.length ||
      // old and new have different items
      (
        differenceBy(oldVariations, newVariations, (v) => v.id).length > 0 ||
        differenceBy(newVariations, oldVariations, (v) => v.id).length > 0
      ) ||
      // percentage(s) is/are changed
      (
        oldVariations.some((v) => v.percentage !== newIndexedObj[v.id]?.percentage) ||
        newVariations.some((v) => v.percentage !== oldIndexedObj[v.id]?.percentage)
      )
    ) {

      return {
        op: OperationEnum.UPDATE,
        label: $localize `:@@differ.serve-value:serve value`,
        isMultiValue: true,
        path: path,
        value: newVariations.length > 1 ? newVariations.map((v) => `${v.label} (${v.percentage}%)`) : newVariations.map((v) => v.label),
        oldValue: oldVariations.length > 1 ? oldVariations.map((v) => `${v.label} (${v.percentage}%)`) : oldVariations.map((v) => v.label)
      };
    }

    return null;
  }

  static mapConditionToDiffCondition(condition: ICondition, segments: ISegment[] = []) {
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

  private static convertArrayToObj (arr: any[], uniqKey: string): ObjectType {
    if (uniqKey !== '$index') {
      return keyBy(arr, uniqKey);
    } else {
      return arr.reduce((acc, cur, idx) => {
        acc[idx] = cur;
        return acc;
      }, {});
    }
  };
}
