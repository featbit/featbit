import { startOfMinute } from 'date-fns'
import { getTimezoneString } from "@utils/index";

export enum PeriodOption {
  Last30m = '30m',
  Last2H = '2H',
  Last24H = '24H',
  Last7D = '7D',
  Last14D = '14D',
  Last1M = '1M',
  Last2M = '2M',
  Last6M = '6M',
  Last12M = '12M'
}

export enum IntervalType {
  Month = 'MONTH',
  Week = 'WEEK',
  Day = 'DAY',
  Hour = 'HOUR',
  Minute = 'MINUTE'
}

export interface IInsights {
  time: Date,
  variations: IVariationInsights[]
}

export interface IVariationInsights {
  variation: string,
  count: number
}

export interface IInsightsFilter {
  featureFlagKey: string,
  intervalType: IntervalType,
  from: number, // included
  to: number, // included
  timezone: string
}

export interface IFeatureFlagEndUserFilter {
  query: string,
  featureFlagKey: string,
  variationId: string,
  from: number, // included
  to: number, // included
  pageIndex: number;
  pageSize: number;
}

export interface IFeatureFlagEndUser {
  id: string,
  variation: string,
  keyId: string,
  name: string,
  lastEvaluatedAt: Date
}

export interface IFeatureFlagEndUserPagedResult {
  totalCount: number;
  items: IFeatureFlagEndUser[];
}


export class InsightsFilter {
  period: PeriodOption = PeriodOption.Last7D;
  intervalType: IntervalType = IntervalType.Day;

  variationId: string = '';
  userQuery: string = '';
  endUserPageSize: number = 5;
  endUserPageIndex: number = 1;

  constructor(public featureFlagKey: string) {
  }

  get filter(): IInsightsFilter {
    const [from, to] = this.getFromAndTo();

    return {
      featureFlagKey: this.featureFlagKey,
      intervalType: this.intervalType,
      from,
      to,
      timezone: getTimezoneString()
    }
  }

  get endUserFilter(): IFeatureFlagEndUserFilter {
    const [from, to] = this.getFromAndTo();

    return {
      from,
      to,
      pageIndex: this.endUserPageIndex,
      pageSize: this.endUserPageSize,
      query: this.userQuery,
      featureFlagKey: this.featureFlagKey,
      variationId: this.variationId
    };
  }

  get days(): [string, string][] {
    const [fromStr, toStr] = this.getFromAndTo();
    const from = new Date(fromStr),
      to = new Date(toStr);

    let dayEnd;
    const days = [];

    while(from < to) {
      dayEnd = new Date(from.toISOString());
      dayEnd.setDate(from.getDate());
      dayEnd.setHours(23,59,59,999);

      days.push([from.toISOString(), dayEnd.toISOString()]);
      from.setDate(from.getDate() + 1);
    }

    return days;
  }

  getFromAndTo(): [number, number] {
    let from, to, startDate, endDate;

    const today = new Date();

    endDate = new Date(today.getTime());

    switch (this.period) {
      case PeriodOption.Last30m:
        // @ts-ignore
        startDate = today.addMinutes(-30);

        break;
      case PeriodOption.Last2H:
        // @ts-ignore
        startDate = today.addHours(-2);

        break;
      case PeriodOption.Last24H:
        // @ts-ignore
        startDate = today.addHours(-24);

        break;
      case PeriodOption.Last7D:
        // @ts-ignore
        startDate = today.addDays(-7);

        break;
      case PeriodOption.Last14D:
        // @ts-ignore
        startDate = today.addDays(-14);

        break;
      case PeriodOption.Last1M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 1));

        break;
      case PeriodOption.Last2M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 2));

        break;
      case PeriodOption.Last6M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 6));

        break;
      case PeriodOption.Last12M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 12));

        break;
    }

    from = startOfMinute(startDate).getTime();
    to = startOfMinute(endDate).getTime();

    return [from, to];
  }
}

// @ts-ignore
Date.prototype.addMinutes = function(munites) {
  var date = new Date(this.valueOf());
  return new Date(date.getTime() + (munites * 60 * 1000));
}

// @ts-ignore
Date.prototype.addHours = function(hours) {
  var date = new Date(this.valueOf());
  return new Date(date.getTime() + (hours * 3600 * 1000));
}

// @ts-ignore
Date.prototype.addDays = function(days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

// @ts-ignore
Date.prototype.addMonths = function(months) {
  var date = new Date(this.valueOf());
  date.setMonth(date.getMonth() - 1 + months);
  return date;
}
