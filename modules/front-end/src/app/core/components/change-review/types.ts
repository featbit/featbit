export enum ReviewModalKindEnum {
  Review = 0,
  Schedule = 1,
  Approval = 2
}

export interface ChangeReviewResult {
  comment?: string,
  hasSchedule: boolean,
  scheduledTime?: string,
}

export class ChangeReviewOutput {
  constructor(
    public comment: string,
    public hasSchedule: boolean,
    public scheduledTime?: Date) {
  }

  get data() {
    const result: ChangeReviewResult = { hasSchedule: this.hasSchedule };

    if (this.hasSchedule) {
      result.scheduledTime = this.scheduledTime.toISOString();
    } else {
      result.comment = this.comment;
    }

    return result;
  }
}
