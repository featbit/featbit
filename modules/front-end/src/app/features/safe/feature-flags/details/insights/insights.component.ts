import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChartConfig } from "@core/components/g2-chart/g2-line-chart/g2-line-chart";
import { FeatureFlagService } from "@services/feature-flag.service";
import { IVariation } from "@shared/rules";
import { EnvUserService } from "@services/env-user.service";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { uuidv4 } from "@utils/index";
import {
  IFeatureFlagEndUserPagedResult,
  IntervalType,
  PeriodOption,
  InsightsFilter
} from "@features/safe/feature-flags/details/insights/types";

@Component({
  selector: 'insights',
  templateUrl: './insights.component.html',
  styleUrls: ['./insights.component.less']
})
export class InsightsComponent implements OnInit {

  usage: string = '';

  isLoading: boolean = true;

  chartConfig: ChartConfig;
  variations: IVariation[] = [];

  $chartSearch: Subject<void> = new Subject();
  $endUserSearch: Subject<void> = new Subject();

  featureFlagVariationAllId: string = uuidv4();

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private endUserService: EnvUserService
  ) { }

  ngOnInit(): void {
    this.$chartSearch.pipe(
      debounceTime(0)
    ).subscribe(() => {
      this.loadFeatureFlagUsage();
    });

    this.$endUserSearch.pipe(
      debounceTime(200)
    ).subscribe(() => {
      this.loadEndUsers();
    });

    this.route.paramMap.subscribe(paramMap => {
      this.filter = new InsightsFilter(decodeURIComponent(paramMap.get('key')));
      this.featureFlagService.getByKey(this.filter.featureFlagKey).subscribe((res) => {
        this.variations = [{ id: this.featureFlagVariationAllId, name: $localize `:@@common.all:All`, value: $localize `:@@common.all:All`}, ...res.variations];
        this.filter.variationId = this.featureFlagVariationAllId;
        this.setIntervalTypes();
        this.filterChanged();
      });
    });
  }

  filter: InsightsFilter;

  intervalTypes: any[];
  private setIntervalTypes() {
    switch (this.filter.period) {
      case PeriodOption.Last30m:
        this.intervalTypes = [{
          value: IntervalType.Minute,
          label: $localize `:@@common.minute:Minute`
        }];

        break;
      case PeriodOption.Last2H:
        this.intervalTypes = [
          {
            value: IntervalType.Hour,
            label: $localize `:@@common.hour:Hour`
          },
          {
            value: IntervalType.Minute,
            label: $localize `:@@common.minute:Minute`
          }
        ];

        break;
      case PeriodOption.Last24H:
        this.intervalTypes = [{
          value: IntervalType.Hour,
          label: $localize `:@@common.hour:Hour`
        }];

        break;
      case PeriodOption.Last7D:
      case PeriodOption.Last14D:
        this.intervalTypes = [{
          value: IntervalType.Day,
          label: $localize `:@@common.day:Day`
        }];

        break;
      case PeriodOption.Last1M:
        this.intervalTypes = [
          {
            value: IntervalType.Day,
            label: $localize `:@@common.day:Day`
          },
          {
            value: IntervalType.Week,
            label: $localize `:@@common.week:Week`
          }
        ];

        break;
      case PeriodOption.Last2M:
      case PeriodOption.Last6M:
      case PeriodOption.Last12M:
        this.intervalTypes = [
          {
            value: IntervalType.Day,
            label: $localize `:@@common.day:Day`
          },
          {
            value: IntervalType.Week,
            label: $localize `:@@common.week:Week`
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
    this.$chartSearch.next();
    this.$endUserSearch.next();
  }

  loadFeatureFlagUsage() {
    this.isLoading = true;

    this.featureFlagService.getInsights(this.filter.filter).subscribe({
      next: (insights) => {
        const source = insights.flatMap((stat) => {
          const sum = stat.variations.reduce((acc, cur) => acc + cur.count, 0);
          return [...stat.variations, { variation: $localize`:@@common.total:Total`, count: sum }].map((v) => {
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
            name: $localize`:@@common.time:Time`,
            field: 'time',
            position: 'end',
            scale: { type: "timeCat", nice: true, range: [0.05, 0.95], mask: this.getXAxisMask() }
          },
          yAxis: {
            name: '',
            position: 'end',
            field: 'value',
            scale: { nice: true }
          },
          source: source as any,
          dataGroupBy: 'label',
          padding: [50, 50, 50, 70],
          lineShape: 'smooth',
          toolTip: { tplFormatter: tpl => tpl.replace("{value}", `{value}`) },
        };

        // data loaded
        this.isLoading = false;
      },
      error: () => this.isLoading = false
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

  /**************************End user table **********************************/
  isEndUserLoading: boolean = true;
  pagedEndUser: IFeatureFlagEndUserPagedResult = {
    items: [],
    totalCount: 0
  };

  endUserFilterChanged() {
    this.$endUserSearch.next();
  }

  loadEndUsers() {
    this.isEndUserLoading = true;
    const variationId = this.filter.endUserFilter.variationId === this.featureFlagVariationAllId ? null : this.filter.endUserFilter.variationId;

    this.endUserService.searchByFlag({...this.filter.endUserFilter, ...{ variationId }}).subscribe((res) => {
      this.pagedEndUser = { ...res };
      this.isEndUserLoading = false;
    }, () => this.isEndUserLoading = false);
  }
}
