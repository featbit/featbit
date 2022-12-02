import {IChange} from "ffc-json-diff";
import { IReadableChange, ITranslationConfig } from "./types";
import { isKeyPathExactMatchPattern, isKeyPathLeftMatchPattern, isLeafNode } from "./utils";
import changesets from 'ffc-json-diff';

export class Differ {
  constructor(private options) {
    if (!this.options) {
      throw new Error('options cannot be null');
    }
  }

  generateDiff(objA: any, objB: any): [number, string] {
    const normalizedA = this.options.normalizeFunc(objA);
    const normalizedB = this.options.normalizeFunc(objB);

    const diffs = changesets.diff(normalizedA, normalizedB, this.options.embededKeys);
    //return transformDiffsToHtml(diffs, this.options.ignoredKeyPaths, this.options.translationConfigs, this.options.translation);
    const r = transformDiffsToHtml(diffs, this.options.ignoredKeyPaths, this.options.translationConfigs);
    console.log(r);
    return r;
  }
}

const transformDiffsToHtml = (changesets: IChange[], ignoredKeyPathPatterns: string[][], translationConfigs: ITranslationConfig[]): [number, string] => {
  let flatChanges: IReadableChange[] = getFlatChanges(changesets, []);

  flatChanges = flatChanges.filter(r => !isKeyPathLeftMatchPattern(r.keyPath, ignoredKeyPathPatterns));
  const readable = translationConfigs
      .sort((a: ITranslationConfig, b: ITranslationConfig) => a.order - b.order)
      .map(config => {
          const matchedChanges = flatChanges.filter(change => config.keyPathPatterns.some(pattern => isKeyPathExactMatchPattern(change.keyPath, [pattern])));

          if (matchedChanges.length === 0) {
              return null;
          }

          return config.getContentFunc(matchedChanges);
      }).filter(r => r !== null);

  return [readable.reduce((acc, cur) => acc + cur.count, 0), readable.map((r) => r.html).join('')];
}

const getFlatChanges = (changesets: IChange[], keyPath: string[]): IReadableChange[] => {
  let result: IReadableChange[] = [];

  changesets.forEach((change: IChange) => {
      if (isLeafNode(change)) {
          result = [...result, getLeafFlatChange(change,  [...keyPath, change.key])];
      } else {
          result = [...result, ...getFlatChanges(change.changes!, [...keyPath, change.key])];
      }
  });

  return result;
}

const getLeafFlatChange = (change: IChange, keyPath: string[]): IReadableChange => {
  return {
      keyPath: keyPath,
      change: change
  }
}

