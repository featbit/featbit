import _ from 'lodash';

import {
  ICategory,
  IChange,
  IDiffVarationUser,
  IRefType,
  ObjectType,
  OperationEnum,
  PrimitiveType
} from "@shared/diff/types";
import {IRuleVariation, IVariation} from "@shared/rules";
import {IVariationUser} from "@features/safe/feature-flags/types/details";
import {IUserType} from "@shared/types";

export interface IDiffer {
  getChangeList(obj1Str: string, obj2Str: string, ref: IRefType): ICategory[]
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
      const addedUsers = _.differenceBy(vu.users, oldUsers, (user) => user.keyId);
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
      const removedUsers = _.differenceBy(oldUsers, vu.users, (user) => user.keyId);
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
        _.differenceBy(oldVariations, newVariations, (v) => v.id).length > 0 ||
        _.differenceBy(newVariations, oldVariations, (v) => v.id).length > 0
      ) ||
      // percentage(s) is/are changed
      (
        oldVariations.some((v) => v.percentage !== newIndexedObj[v.id]?.percentage) ||
        newVariations.some((v) => v.percentage !== oldIndexedObj[v.id]?.percentage)
      )
    ) {

      return {
        op: OperationEnum.UPDATE,
        label: $localize `:@@differ.serve-value:Serve`,
        isMultiValue: true,
        path: path,
        value: newVariations.length > 1 ? newVariations.map((v) => `${v.label} (${v.percentage}%)`) : newVariations.map((v) => v.label),
        oldValue: oldVariations.length > 1 ? oldVariations.map((v) => `${v.label} (${v.percentage}%)`) : oldVariations.map((v) => v.label)
      };
    }

    return null;
  }

  static mapVariationUserToDiffVarationUser(variationUsers: IVariationUser[], variations: IVariation[], users: IUserType[]): IDiffVarationUser[] {
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

  private static convertArrayToObj (arr: any[], uniqKey: string): ObjectType {
    if (uniqKey !== '$index') {
      return _.keyBy(arr, uniqKey);
    } else {
      return arr.reduce((acc, cur, idx) => {
        acc[idx] = cur;
        return acc;
      }, {});
    }
  };
}
