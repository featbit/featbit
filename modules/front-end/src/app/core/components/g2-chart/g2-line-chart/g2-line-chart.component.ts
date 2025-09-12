import {AfterViewInit, Component, Input, OnDestroy} from '@angular/core';
import {Chart} from "@antv/g2";
import {AxisConfig, ChartConfig, defaultTooltipItemTplPlaceholder} from "./g2-line-chart";
import {MacaronColors} from "../g2-chart";
import { fromEvent, Subscription } from 'rxjs';

@Component({
    selector: 'g2-line-chart',
    template: `
    <div id="line-chart-container-{{this.containerId ? this.containerId : ''}}" [ngStyle]="{width, height}">
    </div>
  `,
    standalone: false
})
export class G2LineChartComponent implements AfterViewInit, OnDestroy {
  @Input()
  containerId: string = '';
  @Input() width: string = "100%";
  @Input()
  chartConfig: ChartConfig;

  @Input() defaultWindowHeight: number = 968;

  @Input()
  set defaultChartHeight(value: number) {
    this.defaultChartMaxHeight = value;
    if(this.defaultChartMaxHeight) {
      this.computeCurrentChartHeight();
    }
  }

  private resizeSubscription: Subscription;
  private defaultChartMaxHeight: number = 0;
  public height: string = "400px";

  chart: Chart;

  ngAfterViewInit(): void {
    if (!this.chartConfig) {
      console.error('failed to render chart, invalid chart config...');
      return;
    }

    this.renderChart();
  }

  constructor() {
    this.listenerWindowResize();
  }

  // 计算当前图表的高度
  private computeCurrentChartHeight() {
    const bodyHeight = document.body.clientHeight;
    this.height = this.defaultChartMaxHeight * (bodyHeight / this.defaultWindowHeight) + 'px';
  }

  // 监听窗口大小改变
  private listenerWindowResize() {
    this.resizeSubscription = fromEvent(window, "resize").subscribe(_ => {
      this.defaultWindowHeight && this.computeCurrentChartHeight();
    })
  }

  private renderChart() {
    this.chart = new Chart({
      container: `line-chart-container-${this.containerId}`,
      autoFit: true,
      padding: this.chartConfig.padding
    });

    this.chart.data(this.chartConfig.source);

    const xAxis = this.chartConfig.xAxis;
    const yAxis = this.chartConfig.yAxis;

    this.configChartAxis(xAxis);
    this.configChartAxis(yAxis);

    const toolTip = this.chartConfig.toolTip;
    this.chart.tooltip({
      showCrosshairs: true,
      shared: true,
      itemTpl: toolTip && toolTip.tplFormatter
        ? toolTip.tplFormatter(defaultTooltipItemTplPlaceholder)
        : defaultTooltipItemTplPlaceholder
    });

    const line = this.chart
      .line()
      .position(`${xAxis.field}*${yAxis.field}`)
      .shape(this.chartConfig.lineShape || 'circle');

    const point = this.chart
      .point()
      .position(`${xAxis.field}*${yAxis.field}`)

    const dataGroupBy = this.chartConfig.dataGroupBy;
    if (dataGroupBy) {
      line.color(this.chartConfig.dataGroupBy, MacaronColors);
      point.color(this.chartConfig.dataGroupBy, MacaronColors);
    }

    this.chart.legend({
      padding: [-5, -5, -5, -5],
      marker: {
        symbol: 'hyphen'
      }
    });

    this.chart.render();
  }

  private configChartAxis({field, formatter, name, position, scale}: AxisConfig): void {
    this.chart.axis(field, {
      title: {
        text: name,
        position: position
      },
      label: {
        formatter: formatter
      }
    });

    if (scale) {
      this.chart.scale(field, scale);
    }
  }

  ngOnDestroy(): void {
    this.resizeSubscription && this.resizeSubscription.unsubscribe();
  }
}
