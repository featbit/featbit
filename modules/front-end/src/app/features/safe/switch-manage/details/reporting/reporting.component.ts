import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {SwitchService} from '@services/switch.service';
import {map} from 'rxjs/operators';
import { ChartConfig } from "@shared/g2-chart/g2-line-chart/g2-line-chart";


@Component({
  selector: 'switch-reporting',
  templateUrl: './reporting.component.html',
  styleUrls: ['./reporting.component.less']
})
export class ReportingComponent implements OnInit {

  public switchId: string = '';
  public usage: string = '';

  public isLoading: boolean = true;

  public selectedTimeSpanKey: string = 'P7D';
  public timeSpans = [
    {key: 'P7D', value: '查看最近7天'},
    {key: 'P1D', value: '查看最近24小时'},
    {key: 'PT2H', value: '查看最近2小时'},
    {key: 'PT30M', value: '查看最近30分钟'},
  ];

  chartConfig: ChartConfig;

  constructor(
    private route: ActivatedRoute,
    private switchServe: SwitchService
  ) {
    this.switchId = this.route.snapshot.params['id'];
  }

  ngOnInit(): void {
    this.getFeatureFlagUsage();
  }

  public getFeatureFlagUsage() {
    this.isLoading = true;

    this.switchServe.getReport(this.switchId, this.selectedTimeSpanKey)
      .pipe(
        map(res => {
          let userUsageStr = "";
          let userByVariationValue = JSON.parse(res.userByVariationValue);

          if (userByVariationValue && userByVariationValue.aggregations &&
            userByVariationValue.aggregations.group_by_status &&
            userByVariationValue.aggregations.group_by_status.buckets &&
            userByVariationValue.aggregations.group_by_status.buckets.length > 0) {
            let buckets = userByVariationValue.aggregations.group_by_status.buckets;
            for (let i = 0; i < buckets.length; i++) {
              userUsageStr += `| ${buckets[i].key}: ${buckets[i].doc_count} 次调用 `
            }
            userUsageStr += "|";
          }
          this.usage = userUsageStr;

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
              name: '时间',
              field: 'time',
              position: 'end',
              scale: {type: "timeCat", nice: true, range: [0.05, 0.95], mask: 'YYYY-MM-DD HH:mm'}
            },
            yAxis: {name: '调用次数', field: 'count', position: 'end', scale: {nice: true}},
            padding: [50, 50, 50, 70],
            toolTip: {
              tplFormatter: tpl => tpl
                .replace("{name}", "调用次数")
                .replace("{value}", "{value} 次")
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
