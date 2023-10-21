export enum ReviewModalKindEnum {
  Save = 1,
  Schedule = 2,
  ChangeRequest = 4
}

export const ReviewModalMode = {
  isScheduleEnabled(option: number){
    return option & ReviewModalKindEnum.Schedule;
  },

  isChangeRequestEnabled(option: number){
    return option & ReviewModalKindEnum.ChangeRequest;
  },

  enableSchedule(option: number){
    return option | ReviewModalKindEnum.Schedule;
  },

  disableSchedule(option: number){
    return option & ~ReviewModalKindEnum.Schedule;
  },

  enableChangeRequest(option: number){
    return option | ReviewModalKindEnum.ChangeRequest;
  },

  disableChangeRequest(option: number){
    return option & ~ReviewModalKindEnum.ChangeRequest;
  }
}

export interface FlagSchedule {
  scheduledTime: Date,
  title: string,
}

export interface ChangeReviewOutput {
  comment?: string,
  schedule?: FlagSchedule,
}
