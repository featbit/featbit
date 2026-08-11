export enum FlagTriggerActionEnum {
  TurnOn = 'turn-on',
  TurnOff = 'turn-off'
}

export enum FlagTriggerTypeEnum {
  FeatureFlagGeneral = 'feature-flag-general',
}

export interface IFlagTrigger {
  id?: string,
  createdAt?: Date,
  updatedAt?: Date,
  targetId: string,
  type: string,
  action: string,
  token?: string,
  description?: string,
  isEnabled: boolean,
  triggeredTimes?: number,
  lastTriggeredAt?: Date,

  // UI only
  canCopyToken?: boolean,
  triggerUrl?: string,
}

