import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {map} from 'rxjs/operators';
import { ChartConfig } from "@core/components/g2-chart/g2-line-chart/g2-line-chart";
import {IntervalOption, ReportFilter} from "@features/safe/feature-flags/details/reporting/types";
import {FeatureFlagService} from "@services/feature-flag.service";


@Component({
  selector: 'ff-reporting',
  templateUrl: './reporting.component.html',
  styleUrls: ['./reporting.component.less']
})
export class ReportingComponent implements OnInit {

  public key: string = '';
  public usage: string = '';

  public isLoading: boolean = true;

  public selectedTimeSpanKey: string = 'P7D';
  public timeSpans = [
    {key: 'P7D', value: $localize `:@@common.last-7d:Last 7 days`},
    {key: 'P1D', value: $localize `:@@common.last-24h:Last 24 hours`},
    {key: 'PT2H', value: $localize `:@@common.last-2h:Last 2 hours`},
    {key: 'PT30M', value: $localize `:@@common.last-30m:Last 30 minutes`},
  ];

  chartConfig: ChartConfig;

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService
  ) {
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      this.key = decodeURIComponent(paramMap.get('key'));
      this.filter = new ReportFilter();
      this.getFeatureFlagUsage();
    });
  }

  filter: ReportFilter;

  intervalOptions = [
    {
      value: IntervalOption.Last24H,
      label: $localize `:@@common.last-7d:Last 24 hours`
    },
    {
      value: IntervalOption.Last7D,
      label: $localize `:@@common.last-7d:Last 7 days`
    },
    {
      value: IntervalOption.Last14D,
      label: '最近14天'
    },
    {
      value: IntervalOption.Last1M,
      label: '最近1个月'
    },
    {
      value: IntervalOption.Last2M,
      label: '最近2个月'
    },
    {
      value: IntervalOption.Last6M,
      label: '最近6个月'
    },
    {
      value: IntervalOption.Last12M,
      label: '最近12个月'
    }
  ];

  filterChanged() {
    console.log('filterChanged');
    // this.uniqueUserDays = [this.activeUserFilter.getFromAndTo(), ...this.activeUserFilter.days];
    // this.loadActiveUsers();
    // this.loadUniqueUsers();
  }

  public getFeatureFlagUsage() {
    this.isLoading = true;

    this.featureFlagService.getReport(this.filter.filter)
      .pipe(
        map(res => {
          let chartData = JSON.parse(res.chartData);
          return chartData || {};
        })
      )
      .subscribe(
        res => {
          let buckets = [];
          if (res && res.aggregations &&
            res.aggregations.range &&
            res.aggregations.range.buckets &&
            res.aggregations.range.buckets.length > 0) {
            buckets = res.aggregations.range.buckets;
          }

          // init chart config
          const data = buckets.map(bucket =>
            ({
              time: new Date(bucket.to_as_string.replace('T', ' ') + ' UTC'),
              count: bucket.doc_count,
            })
          );
          this.chartConfig = {
            source: data as any[],
            xAxis: {
              name: $localize `:@@common.time:Time`,
              field: 'time',
              position: 'end',
              scale: {type: "timeCat", nice: true, range: [0.05, 0.95], mask: 'YYYY-MM-DD HH:mm'}
            },
            yAxis: {name: $localize `:@@common.times-call:Times of call`, field: 'count', position: 'end', scale: {nice: true}},
            padding: [50, 50, 50, 70],
            toolTip: {
              tplFormatter: tpl => tpl
                .replace("{name}", $localize `:@@common.times-call:Times of call`)
                .replace("{value}", "{value}")
            }
          };

          // data loaded
          this.isLoading = false;
        }
      );
  }

  public onTimeSpanClick(timeSpan: string) {
    this.selectedTimeSpanKey = timeSpan;
    this.getFeatureFlagUsage();
  }
}
