export enum FlagTriggerAction {
  On = 1,
  Off = 2
}

export enum FlagTriggerStatus {
  Enabled = 1,
  Disabled = 2,
  Archived = 3
}

export enum FlagTriggerType {
  GenericTrigger = 1,
}

export interface IFlagTrigger {
  id?: string;
  featureFlagId: string;
  times?: number; // called times
  status?: FlagTriggerStatus;
  statusName?: string;
  action: FlagTriggerAction;
  actionName?: string;
  type: FlagTriggerType;
  typeName?: string;
  token?: string;
  description?: string;
  updatedAt?: string;
  canCopyToken?: boolean;
  triggerUrl?: string;
  lastTriggeredAt?: string;
}

