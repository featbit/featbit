import { IUserType } from "@shared/types";
import {deepCopy, uuidv4} from "@utils/index";
import {handleRulesBeforeSave, ICondition, IRule} from "@shared/rules";
import { getCurrentEnvRN } from "@utils/project-env";

export interface ISegmentListModel {
  items: ISegment[];
  totalCount: number;
}

export enum SegmentType {
  EnvironmentSpecific = "environment-specific",
  Shared = "shared"
}

export interface CreateSegment {
  name: string;
  key: string;
  type: SegmentType;
  scopes: string[];
  description: string;
}

export interface ISegment {
  id: string;
  name: string;
  key: string;
  type: SegmentType;
  scopes: string[];
  tags: string[];
  description: string;
  updatedAt: Date;
  included: string[];
  excluded: string[];
  rules: IRule[];
  isArchived: boolean;
  comment?: string
}

export interface ISegmentFlagReference {
  envId: string,
  id: string,
  name: string,
  key: string
}

export type UpdateSegmentTargetingPayload = {
  included: string[];
  excluded: string[];
  rules: IRule[];
  comment: string;
}

export class SegmentListFilter {
  constructor(
    public name?: string,
    public userKeyId?: string,
    public isArchived?: boolean,
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
    this.name = name ?? '';
    this.isArchived = !!isArchived;
  }
}

export const getSegmentRN = (key: string, tags: string[]) => {
  const prefix = getCurrentEnvRN();

  if (!prefix) {
    return undefined;
  }

  let rn = `${prefix}:segment/${key}`;
  if (tags.length > 0) {
    rn = `${rn};${tags.join(",")}`;
  }

  return rn;
}

export class Segment {
  private _includedUsers: IUserType[] = [];
  private _excludedUsers: IUserType[] = [];

  originalData: ISegment;

  constructor(data: ISegment) {
    for (let p in data) {
      if (data[p] !== null && (Array.isArray(data[p]) || typeof data[p] === 'object')) {
        this[p] = deepCopy(data[p]);
      } else {
        this[p] = data[p];
      }
    }

    this.originalData = deepCopy(data);
  }

  get targetingDataToSave() {
    try{
      this.rules = handleRulesBeforeSave(this.rules);

      return {
        rules: this.rules,
        included: this._includedUsers.map(u => u.keyId),
        excluded: this._excludedUsers.map(u => u.keyId)
      };
    } catch (err){
      console.log(err);
    }
  }

  get dataToSave() {
    try{
      this.rules = handleRulesBeforeSave(this.rules);

      const res = {};
      for (let p in this.originalData) {
        res[p] = this[p];
      }

      return res;
    } catch (err){
      console.log(err);
    }
  }

  set includedUsers(value: IUserType[]) {
    this._includedUsers = [...value];
    this.included = value.map(v => v.keyId);
  }

  get includedUsers() {
    return this._includedUsers;
  }

  set excludedUsers(value: IUserType[]) {
    this._excludedUsers = [...value];
    this.excluded = value.map(v => v.keyId);
  }

  get excludedUsers() {
    return this._excludedUsers;
  }

  get isShared(): boolean {
    return this.type === SegmentType.Shared;
  }

  newRule() {
    this.rules.push({
      id: uuidv4(),
      name: ($localize `:@@common.rule:Rule`) + ' ' + (this.rules.length + 1),
      conditions: []
    } as IRule);
  }

  removeRule(index: number) {
    this.rules.splice(index, 1);
  }

  updateRuleConditions(condition: ICondition[], index: number) {
    this.rules[index].conditions = condition;
  }

  addTag(tag: string) {
    this.tags = [...this.tags, tag];
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter(x => x !== tag);
  }

  get rn(): string {
    return getSegmentRN(this.originalData.key, this.originalData.tags);
  }

  id: string;
  key: string;
  type: SegmentType;
  name: string;
  description: string;
  included: string[];
  excluded: string[];
  tags: string[];
  rules: IRule[];
}
