import { IUserType } from "@shared/types";
import { uuidv4 } from "@utils/index";
import {handleRulesBeforeSave, ICondition, IRule} from "@shared/rules";

export interface ISegmentListModel {
  items: ISegment[];
  totalCount: number;
}

export interface ISegment {
  id: string;
  name: string;
  description: string;
  updatedAt: Date;
  included: string[];
  excluded: string[];
  rules: IRule[];
  isArchived: boolean;
}

export interface ISegmentFlagReference {
  id: string,
  name: string,
  key: string
}

export class SegmentListFilter {
  constructor(
    public name?: string,
    public userKeyId?: string,
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
    this.name = name ?? '';
  }
}

export class Segment {
  private readonly data: ISegment;
  private _includedUsers: IUserType[] = [];
  private _excludedUsers: IUserType[] = [];

  constructor(segment: ISegment) {
    this.data = {...segment};

    this.data.rules = segment.rules ?? [];
  }

  get segment() {
    return {...this.data};
  }

  get dataToSave() {
    try{
      this.data.rules = handleRulesBeforeSave(this.data.rules);

      return {
        ...this.data,
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
    return this.data.rules;
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
