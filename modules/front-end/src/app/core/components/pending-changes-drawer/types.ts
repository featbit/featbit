import { IDataChange } from "@core/components/audit-log/types";

export interface IPendingChanges {
  id: string;
  flagId: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  scheduledTime: string;
  dataChange: IDataChange;
}
