export enum IntervalOption {
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
  Day = 'DAY'
}

export interface IReportingFilter {
  key: string,
  intervalType: IntervalType,
  from: string, // included
  to: string, // included
  tzOffset: string
}

export class ReportFilter {
  key: string;
  interval: IntervalOption = IntervalOption.Last7D;
  intervalType: IntervalType = IntervalType.Day;
  userQuery: string = '';

  constructor() {
  }

  get filter(): IReportingFilter {
    const [from, to] = this.getFromAndTo();

    return {
      key: this.key,
      intervalType: this.intervalType,
      from,
      to,
      tzOffset: this.getTimezoneOffsetInHours()
    }
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

  private getTimezoneOffsetInHours() {
    const offset = - new Date().getTimezoneOffset() / 60;

    return encodeURIComponent(`${offset >= 0 ? '+': '-'}${Math.abs(offset)}`);
  }

  getFromAndTo(): [string, string] {
    let from, to, startDate, endDate;

    const today = new Date();

    endDate = new Date(today.getTime());
    endDate.setHours(23,59,59,999);
    to = endDate.toISOString();

    switch (this.interval) {
      case IntervalOption.Last7D:
        // @ts-ignore
        startDate = today.addDays(-6);

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
      case IntervalOption.Last14D:
        // @ts-ignore
        startDate = today.addDays(-13);

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
      case IntervalOption.Last1M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 1));

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
      case IntervalOption.Last2M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 2));

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
      case IntervalOption.Last6M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 6));

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
      case IntervalOption.Last12M:
        // @ts-ignore
        startDate = new Date(today.setMonth(today.getMonth() - 12));

        startDate.setHours(0, 0, 0, 0);
        from = startDate.toISOString();

        break;
    }

    return [from, to];
  }
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
