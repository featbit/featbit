﻿import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import featureFlagDiffer from "@utils/diff/feature-flag.differ";
import {encodeURIComponentFfc} from "@utils/index";

export interface IAuditLogListModel {
  items: IAuditLog[];
  totalCount: number;
}

export enum RefTypeEnum {
  Flag = 'FeatureFlag'
}

export enum AuditLogOpEnum {
  Create = 'Create',
  Update = 'Update',
  Archive = 'Archive',
  Restore = 'Restore',
  Remove = 'Remove'
}

export interface IDataChange {
  previous?: string // undefined if operation is Create
  current?: string // undefined if operation is Remove
}

export interface IAuditLog {
  id: string;
  refId: string;
  refType: string;
  operation: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: string;
  comment: string;
  dataChange: IDataChange;
}

export class AuditLogListFilter {
  constructor(
    public query?: string,
    public creatorId?: string,
    public refType?: RefTypeEnum,
    public range: Date[] = [],
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
  }
}

export class AuditLog {

  readonly data: IAuditLog;
  private previous: IFeatureFlag | string;
  private current: IFeatureFlag | string;

  get targetData(): IFeatureFlag | string {
    switch (this.data.operation) {
      case AuditLogOpEnum.Create:
        return this.current;
      case AuditLogOpEnum.Remove:
        return this.previous;
      default:
        return this.current;
    }
  }

  constructor(data: IAuditLog) {
    this.data = {...data};

    if (this.data.dataChange.previous?.length > 0) {
      try {
        this.previous = JSON.parse(this.data.dataChange.previous);
      } catch (e) {
        this.previous = this.data.dataChange.previous;
      }
    }

    if (this.data.dataChange.current?.length > 0) {
      try {
        this.current = JSON.parse(this.data.dataChange.current);
      } catch (e) {
        this.current = this.data.dataChange.current;
      }
    }
  }

  get diffHtml(): string {
    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        const [ numChanges, changes]  = featureFlagDiffer.generateDiff(this.previous as IFeatureFlag, this.current as IFeatureFlag, {targetingUsers: [], segments: []});
        return changes;
      default:
        return '';
        break;
    }
  }

  get shouldShowChangeList(): boolean {
    return this.data.operation === AuditLogOpEnum.Update;
  }

  get auditLog() {
    return {...this.data};
  }

  get name(): string {
    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        return (this.targetData as IFeatureFlag).name;
      default:
        return (this.targetData as IFeatureFlag).name;
    }
  }

  get titlePrefix(): string {
    let result = this.data.creatorEmail;

    if (this.data.creatorName?.length > 0) {
      result += ` (${this.data.creatorName})`;
    }

    switch (this.data.operation) {
      case AuditLogOpEnum.Create:
        result += ` ${$localize `:@@auditlogs.idx.operation-create:created`}`;
        break;
      case AuditLogOpEnum.Update:
        result += ` ${$localize `:@@auditlogs.idx.operation-update:updated`}`;
        break;
      case AuditLogOpEnum.Archive:
        result += ` ${$localize `:@@auditlogs.idx.operation-archive:archived`}`;
        break;
      case AuditLogOpEnum.Restore:
        result += ` ${$localize `:@@auditlogs.idx.operation-restore:restored`}`;
        break;
      case AuditLogOpEnum.Remove:
        result += ` ${$localize `:@@auditlogs.idx.operation-remove:removed`}`;
        break;
      default:
        result += ` ${this.data.operation}`;
    }

    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        result += ` ${$localize `:@@auditlogs.idx.reftype-flag:the flag`}`;
        break;
      default:
        break;
    }

    return result;
  }
}
