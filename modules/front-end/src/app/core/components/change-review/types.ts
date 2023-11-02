export enum ReviewModalKindEnum {
  Save = 1,
  Schedule = 2,
  ChangeRequest = 4
}

export const ReviewModalMode = {
  isScheduleEnabled(option: number): boolean {
    return (option & ReviewModalKindEnum.Schedule) === ReviewModalKindEnum.Schedule;
  },

  isChangeRequestEnabled(option: number) {
    return (option & ReviewModalKindEnum.ChangeRequest) === ReviewModalKindEnum.ChangeRequest;
  },

  enableSchedule(option: number) {
    return option | ReviewModalKindEnum.Schedule;
  },

  disableSchedule(option: number) {
    return option & ~ReviewModalKindEnum.Schedule;
  },

  enableChangeRequest(option: number) {
    return option | ReviewModalKindEnum.ChangeRequest;
  },

  disableChangeRequest(option: number) {
    return option & ~ReviewModalKindEnum.ChangeRequest;
  }
}

export interface FlagSchedule {
  scheduledTime: Date,
  title: string,
}

export interface FlagChangeRequest {
  reason: string,
  reviewers: string[],
}

export interface ChangeReviewOutput {
  comment?: string,
  schedule?: FlagSchedule,
  changeRequest?: FlagChangeRequest
}
