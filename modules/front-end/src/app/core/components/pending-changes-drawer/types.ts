import { IDataChange } from "@core/components/audit-log/types";
import { IInstruction } from "@core/components/change-list/instructions/types";

export interface IPendingChanges {
  id: string;
  flagId: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  scheduledTime: string;
  dataChange: IDataChange;
  instructions: IInstruction[];
}
