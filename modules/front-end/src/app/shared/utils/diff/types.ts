import { IChange, ObjectType } from "ffc-json-diff"

export interface ITranslationConfig {
  order: number,
  keyPathPatterns: string[][],
  getContentFunc: (param: IReadableChange[]) => IHtmlChanges,
  code: string
}

export interface IReadableChange {
  keyPath: string[],
  change: IChange
}

export interface IHtmlChanges {
  html: string,
  count: number
}

export interface IOptions {
  embededKeys: {[key: string]: string},
  ignoredKeyPaths: string[][],
  translationConfigs: ITranslationConfig[],
  normalizeFunc: (obj: ObjectType) => ObjectType,
  deNormalizeFunc: (obj: ObjectType) => ObjectType,
}
