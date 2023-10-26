import { IInstruction } from "@core/components/change-list/instructions/types";

export enum AuditLogOpEnum {
  Create = 'Create',
  Update = 'Update',
  Archive = 'Archive',
  Restore = 'Restore',
  Remove = 'Remove',
  ApplyFlagChangeRequest = 'ApplyFlagChangeRequest',
  ApplyFlagSchedule = 'ApplyFlagSchedule',

}

export enum RefTypeEnum {
  Flag = 'FeatureFlag',
  Segment = 'Segment'
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
  instructions: IInstruction[];
}

export interface IDataChange {
  previous?: string // undefined if operation is Create
  current?: string // undefined if operation is Remove
}

export interface IAuditLogListModel {
  items: IAuditLog[];
  totalCount: number;
}

export class AuditLogListFilter {
  constructor(
    public query?: string,
    public creatorId?: string,
    public refType?: RefTypeEnum,
    public refId?: string,
    public range: Date[] = [],
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
  }
}
