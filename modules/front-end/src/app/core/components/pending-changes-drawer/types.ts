import { IDataChange } from "@core/components/audit-log/types";
import { IInstruction } from "@core/components/change-list/instructions/types";

export enum PendingChangeType {
  Schedule = 'Schedule',
  ChangeRequest = 'ChangeRequest'
}

export enum PendingChangeStatus {
  PendingReview = 'PendingReview',
  Approved = 'Approved',
  Declined = 'Declined',
  Applied = 'Applied',
  PendingExecution = 'PendingExecution'
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
  status: PendingChangeStatus;
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
  reviewers: IReviewer[];
}
