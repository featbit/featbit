import { IDataChange } from "@core/components/audit-log/types";
import { IInstruction } from "@core/components/change-list/instructions/types";

export enum PendingChangeType {
  Schedule = 'Schedule',
  ChangeRequest = 'ChangeRequest'
}

export enum ChangeRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Declined = 'Declined',
  Applied = 'Applied'
}

export enum ChangeRequestAction {
  Approve = 'Approve',
  Decline = 'Decline',
  Apply = 'Apply',
  Empty = 'Empty'
}

export interface IReviewer {
  memberId: string;
  action: string;
  timestamp: string;
}

export interface IPendingChanges {
  id: string;
  type: PendingChangeType;
  flagId: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  dataChange: IDataChange;
  instructions: IInstruction[];
  scheduleTitle: string;
  scheduledTime: string;
  changeRequestId?: string;
  changeRequestReason: string;
  changeRequestStatus: string;
  reviewers: IReviewer[];
}
