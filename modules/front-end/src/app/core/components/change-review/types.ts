export enum ReviewModalKindEnum {
  Review = 0,
  Schedule = 1,
  Approval = 2
}

export interface FlagSchedule {
  scheduledTime: Date,
  title: string,
}

export interface ChangeReviewOutput {
  comment?: string,
  schedule?: FlagSchedule,
}
