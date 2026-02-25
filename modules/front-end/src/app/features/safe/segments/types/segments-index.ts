import { IUserType } from "@shared/types";
import {deepCopy, uuidv4} from "@utils/index";
import {handleRulesBeforeSave, ICondition, IRule} from "@shared/rules";

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

export class Segment {
  private readonly _data: ISegment;
  private _includedUsers: IUserType[] = [];
  private _excludedUsers: IUserType[] = [];

  originalData: ISegment;

  constructor(segment: ISegment) {
    this.originalData = deepCopy(segment);

    this._data = {...segment};

    this._data.rules = segment.rules ?? [];
  }

  get segment() {
    return {...this._data};
  }

  set name(val: string) {
    this._data.name = val;
    this.originalData.name = val;
  }

  set description(val: string) {
    this._data.description = val;
    this.originalData.description = val;
  }

  get dataToSave() {
    try{
      this._data.rules = handleRulesBeforeSave(this._data.rules);

      return {
        ...this._data,
        included: this._includedUsers.map(u => u.keyId),
        excluded: this._excludedUsers.map(u => u.keyId)
      };
    } catch (err){
      console.log(err);
    }
  }

  set includedUsers(value: IUserType[]) {
    this._includedUsers = [...value];
  }

  get includedUsers() {
    return this._includedUsers;
  }

  set excludedUsers(value: IUserType[]) {
    this._excludedUsers = [...value];
  }

  get excludedUsers() {
    return this._excludedUsers;
  }

  get rules(): IRule[] {
    return this._data.rules;
  }

  get isShared(): boolean {
    return this._data.type === SegmentType.Shared;
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
}
