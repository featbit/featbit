import _ from 'lodash';

import {IChange, ObjectType, OperationEnum, PrimitiveType} from "@shared/diffv2/types";

export interface IDiffer {
  getChangeList(obj1Str: string, obj2Str: string): IChange[]
}


export abstract class Differ {

  static getKey(path: string[]): string {
    return path.length > 0 ? path.slice(-1)[0] : '';
  }

  static compare(oldObj: Object, newObj: Object, path: string[]) {
    const typeOfOldObj: string | null = this.getTypeOfObj(oldObj);
    const typeOfNewObj: string | null = this.getTypeOfObj(newObj);

    let changes: IChange[] = [];
    let diffs: IChange[] = [];

    if (typeOfOldObj !== typeOfNewObj) {
      changes.push({
        op: OperationEnum.REMOVE,
        path: path,
        value: oldObj
      });
      changes.push({
        op: OperationEnum.ADD,
        path: path,
        value: newObj
      });
      return changes;
    }

    switch (typeOfOldObj) {
      case 'Date':
        changes = [...changes, ...this.comparePrimitives((oldObj as Date).getTime(), (newObj as Date).getTime(), path)];
        break;
      case 'Object':
        break;
      case 'Array':
        //changes = [...changes, ...this.compareArray(oldObj as any[], newObj as any[], path, embededObjKeys, keyPath)];
        break;
      case 'Function':
        break;
      default:
        changes = [...changes, ...this.comparePrimitives(oldObj as PrimitiveType, newObj as PrimitiveType, path)];
    }
    return changes;
  }

  private static comparePrimitives (oldObj: PrimitiveType, newObj: PrimitiveType, path: string[]): IChange[] {
    const changes: IChange[] = [];
    if (oldObj !== newObj) {
      changes.push({
        op: OperationEnum.UPDATE,
        path: path,
        value: newObj,
        oldValue: oldObj
      });
    }
    return changes;
  }

  private static compareArray (oldObj: any[], newObj: any[], path: string[], uniqKey: string = '$index'): IChange[] {
    const indexedOldObj: ObjectType = this.convertArrayToObj(oldObj, uniqKey);
    const indexedNewObj: ObjectType = this.convertArrayToObj(newObj, uniqKey);

    const diffs: IChange[] = [];
    if (diffs.length) {
      return [
        {
          op: OperationEnum.UPDATE,
          path: path,
        }
      ];
    } else {
      return [];
    }
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

  private static getTypeOfObj (obj: Object): string | null {
    if (typeof obj === 'undefined')
      return 'undefined'

    if (obj === null)
      return null

    return Object.prototype.toString.call(obj).match(/^\[object\s(.*)\]$/)[1];
  };
}
