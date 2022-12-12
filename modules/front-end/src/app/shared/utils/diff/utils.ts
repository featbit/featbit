import { IChange, Operation } from "ffc-json-diff";

export const isLeafNode = (change: IChange): boolean => !change.changes || (change.value != null) || change.type === Operation.REMOVE;

export const isKeyPathExactMatchPattern = (keyPath: string[], patterns: string[][]): boolean => {
  for (let pattern of patterns) {
      let match = true;

      if (keyPath.length !== pattern.length) {
          match = false;
      }

      let idx = 0
      for (let key of pattern) {
          if (key !== '*' && key !== keyPath[idx]) {
              match = false;
          }

          idx++;
      }

      if (match) {
          return true;
      }
  }

  return false;
};

export const isKeyPathLeftMatchPattern = (keyPath: string[], patterns: string[][]): boolean => {
  if (patterns.length === 0 || patterns.flatMap(p => p).length === 0) {
    return false;
  }

  for (let pattern of patterns) {
      if (keyPath.length < pattern.length) {
          return false;
      }

      let idx = 0
      for (let key of pattern) {
          if (key !== '*' && key !== keyPath[idx]) {
              return false;
          }

          idx++;

          if (idx === pattern.length) {
            // keyPath including pattern => left match
            return true;
          }
      }
  }

  return true;
};

export const getTypeOfObj = (obj: Object): string | null => {
  if (typeof obj === 'undefined')
      return 'undefined'

  if (obj === null)
      return null

  // @ts-ignore: Object is possibly 'null'.
  return Object.prototype.toString.call(obj).match(/^\[object\s(.*)\]$/)[1];
};
