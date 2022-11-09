import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ChartConfig} from "@core/components/g2-chart/g2-line-chart/g2-line-chart";
import {FeatureFlagService} from "@services/feature-flag.service";
import {PeriodOption, IntervalType, ReportFilter} from "@features/safe/feature-flags/details/reporting/types";


@Component({
  selector: 'ff-reporting',
  templateUrl: './reporting.component.html',
  styleUrls: ['./reporting.component.less']
})
export class ReportingComponent implements OnInit {

  public usage: string = '';

  public isLoading: boolean = true;

  chartConfig: ChartConfig;

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService
  ) {
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      this.filter = new ReportFilter(decodeURIComponent(paramMap.get('key')));
      this.setIntervalTypes();
      this.getFeatureFlagUsage();
    });
  }

  filter: ReportFilter;

  intervalTypes: any[];
  private setIntervalTypes() {
    switch (this.filter.period) {
      case PeriodOption.Last30m:
        this.intervalTypes = [{
          value: IntervalType.Minute,
          label: $localize `:@@common.month:Minute`
        }];

        break;
      case PeriodOption.Last2H:
        this.intervalTypes = [
          {
            value: IntervalType.Hour,
            label: $localize `:@@common.month:Hour`
          },
          {
            value: IntervalType.Minute,
            label: $localize `:@@common.month:Minute`
          }
        ];

        break;
      case PeriodOption.Last24H:
        this.intervalTypes = [{
          value: IntervalType.Hour,
          label: $localize `:@@common.month:Hour`
        }];

        break;
      case PeriodOption.Last7D:
      case PeriodOption.Last14D:
        this.intervalTypes = [{
          value: IntervalType.Day,
          label: $localize `:@@common.month:Day`
        }];

        break;
      case PeriodOption.Last1M:
        this.intervalTypes = [
          {
            value: IntervalType.Day,
            label: $localize `:@@common.month:Day`
          },
          {
            value: IntervalType.Week,
            label: $localize `:@@common.month:Week`
          }
        ];

        break;
      case PeriodOption.Last2M:
      case PeriodOption.Last6M:
      case PeriodOption.Last12M:
        this.intervalTypes = [
          {
            value: IntervalType.Day,
            label: $localize `:@@common.month:Day`
          },
          {
            value: IntervalType.Week,
            label: $localize `:@@common.month:Week`
          },
          {
            value: IntervalType.Month,
            label: $localize `:@@common.month:Month`
          }
        ];

        break;
    }
  }

  periodOptions = [
    {
      value: PeriodOption.Last30m,
      label: $localize `:@@common.last-30min:Last 30 minutes`
    },
    {
      value: PeriodOption.Last2H,
      label: $localize `:@@common.last-2h:Last 2 hours`
    },
    {
      value: PeriodOption.Last24H,
      label: $localize `:@@common.last-24h:Last 24 hours`
    },
    {
      value: PeriodOption.Last7D,
      label: $localize `:@@common.last-7d:Last 7 days`
    },
    {
      value: PeriodOption.Last14D,
      label: $localize `:@@common.last-14d:Last 14 days`
    },
    {
      value: PeriodOption.Last1M,
      label: $localize `:@@common.last-1m:Last 1 month`
    },
    {
      value: PeriodOption.Last2M,
      label: $localize `:@@common.last-2m:Last 2 months`
    },
    {
      value: PeriodOption.Last6M,
      label: $localize `:@@common.last-6m:Last 6 months`
    },
    {
      value: PeriodOption.Last12M,
      label: $localize `:@@common.last-12m:Last 12 months`
    }
  ];

  periodChanged() {
    this.setIntervalTypes();
    this.filter.intervalType = this.intervalTypes[0].value;
    this.filterChanged();
  }

  filterChanged() {
    this.getFeatureFlagUsage();
  }

  public getFeatureFlagUsage() {
    this.isLoading = true;

    this.featureFlagService.getReport(this.filter.filter)
      .subscribe((res) => {
        const source = res.flatMap((stat) => {
          const sum = stat.variations.reduce((acc, cur) => acc + cur.count, 0);
          return [...stat.variations, { variation: $localize `:@@common.total:Total`, count: sum}].map((v) => {
            return {
              label: v.variation,
              time: stat.time,
              value: v.count
            }
          });
        });

        const totals = source.reduce((acc, cur) => {
          acc[cur.label] = acc[cur.label] || 0;
          acc[cur.label] += cur.value;
          return acc;
        }, {});

        this.usage = Object.keys(totals).map((key) => `${key}: ${totals[key]}`).join(' | ');

        this.chartConfig = {
          xAxis: {
            name: $localize `:@@common.time:Time`,
            field: 'time',
            position: 'end',
            scale: {type: "timeCat", nice: true, range: [0.05, 0.95], mask: this.getXAxisMask()}
          },
          yAxis: {
            name: '',
            position: 'end',
            field: 'value',
            scale: {nice: true}
          },
          source: source as any,
          dataGroupBy: 'label',
          padding: [50, 50, 50, 70],
          toolTip: { tplFormatter: tpl => tpl.replace("{value}", `{value}`) },
        };

        // data loaded
        this.isLoading = false;
      });
  }

  private getXAxisMask() {
    switch (this.filter.intervalType) {
      case IntervalType.Minute:
      case IntervalType.Hour:
        return 'YYYY-MM-DD HH:mm';
      case IntervalType.Day:
      case IntervalType.Week:
      case IntervalType.Month:
        return 'YYYY-MM-DD';
      default:
        return 'YYYY-MM-DD HH:mm';
    }
  }
}
