import { IChange, ObjectType } from "ffc-json-diff"

export interface ITranslationConfig {
  order: number,
  keyPathPatterns: string[][],
  getContentFunc: (param: IReadableChange[], translations: Translation) => string,
  code: string
}

export interface IReadableChange {
  keyPath: string[],
  change: IChange
}

export type Translation = {[key: string]: string};

export interface IOptions {
  embededKeys: {[key: string]: string},
  ignoredKeyPaths: string[][],
  translationConfigs: ITranslationConfig[],
  translation: {[key: string]: string},
  normalizeFn: (obj: ObjectType) => ObjectType,
  deNormalizeFn: (obj: ObjectType) => ObjectType,
}
