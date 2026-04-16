import { Component, OnInit, inject } from '@angular/core';
import { ChartConfig } from '@core/components/g2-chart/g2-line-chart/g2-line-chart';
import { Data } from '@antv/g2/src/interface';
import { environment } from 'src/environments/environment';
import { HOSTING_MODE } from "@shared/constants";
import { WorkspaceService } from '@core/services/workspace.service';
import { EnvironmentUsage, UsageSummary } from '@features/safe/workspaces/types/workspace';
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize } from 'rxjs/operators';

interface DailyUsage {
  date: string;
  value: number;
}

interface BillingPeriod {
  label: string;
  value: string;
}

@Component({
  selector: 'usage',
  standalone: false,
  templateUrl: './usage.component.html',
  styleUrls: ['./usage.component.less']
})
export class UsageComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private message = inject(NzMessageService);

  isLoading = false;
  isFirstLoad = true;

  isSaas = environment.hostingMode === HOSTING_MODE.SAAS;
  chartVisible = true;

  billingPeriods: BillingPeriod[] = [];
  selectedPeriod!: string;

  get selectedPeriodRange(): string {
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    switch (this.selectedPeriod) {
      case 'last7d': {
        const start = new Date(now); start.setDate(now.getDate() - 6);
        return `${fmt(start)} - ${fmt(now)}`;
      }
      case 'last30d': {
        const start = new Date(now); start.setDate(now.getDate() - 29);
        return `${fmt(start)} - ${fmt(now)}`;
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${fmt(start)} - ${fmt(end)}`;
      }
      case 'currentBilling':
      case 'previousBilling':
        return $localize`:@@workspace.usage.no-data-for-now:No data for now`;
      default:
        return '';
    }
  }

  summary: UsageSummary = {
    mau: 0,
    totalFlagEvaluations: 0,
    totalCustomMetrics: 0,
    prevMau: 0,
    prevFlagEvaluations: 0,
    prevCustomMetrics: 0,
  }

  metricOptions = [
    { label: $localize`:@@workspace.usage.daily-new-users:Daily New Users`, value: 'danu' },
    { label: $localize`:@@workspace.usage.flag-evaluations:Flag Evaluations`, value: 'flagEvaluations' },
    { label: $localize`:@@workspace.usage.custom-metrics:Custom Metrics`, value: 'customMetrics' },
  ];
  selectedMetric = 'dau';
  chartConfig!: ChartConfig;

  envUsages: EnvironmentUsage[] = [];

  private dailyDau: DailyUsage[] = [];
  private dailyFlagEvals: DailyUsage[] = [];
  private dailyCustomMetrics: DailyUsage[] = [];

  ngOnInit(): void {
    this.initBillingPeriods();
    this.loadUsageData();
  }

  initBillingPeriods(): void {
    this.billingPeriods = [
      { label: $localize`:@@workspace.usage.this-month:This month`, value: 'thisMonth' },
      { label: $localize`:@@workspace.usage.last-7-days:Last 7 days`, value: 'last7d' },
      { label: $localize`:@@workspace.usage.last-30-days:Last 30 days`, value: 'last30d' },
    ];

    if (this.isSaas) {
      this.billingPeriods.unshift(
        { label: $localize`:@@workspace.usage.current-billing-cycle:Current billing cycle`, value: 'currentBilling' },
        { label: $localize`:@@workspace.usage.previous-billing-cycle:Previous billing cycle`, value: 'previousBilling' },
      );
    }

    this.selectedPeriod = this.billingPeriods[0].value;
  }

  onPeriodChange(): void {
    this.loadUsageData();
  }

  onMetricChange(value: number | string): void {
    this.selectedMetric = this.metricOptions.find(opt => opt.value === value)?.value || 'dau';
    this.chartVisible = false;
    this.updateChart();
    setTimeout(() => this.chartVisible = true);
  }

  private loadUsageData(): void {
    this.isLoading = true;
    this.workspaceService.getUsage().pipe(
      finalize(() => {
        this.isLoading = false;
        this.isFirstLoad = false;
      })
    ).subscribe({
      next: (usage) => {
        if (usage) {
          this.summary = usage.summary;
          this.envUsages = usage.environmentUsages;
          this.dailyDau = usage.dailyTrend.map(item => ({ date: item.date, value: item.newUsers }));
          this.dailyFlagEvals = usage.dailyTrend.map(item => ({ date: item.date, value: item.flagEvaluations }));
          this.dailyCustomMetrics = usage.dailyTrend.map(item => ({ date: item.date, value: item.customMetrics }));

          this.chartVisible = false;
          this.updateChart();
          setTimeout(() => this.chartVisible = true);
        }
      },
      error: () => {
        this.message.error($localize`:@@common.failed-to-load-data:Failed to load data`);
      }
    });
  }

  updateChart(): void {
    let source: DailyUsage[];
    let yAxisName: string;
    let lineColor: string;

    switch (this.selectedMetric) {
      case 'flagEvaluations':
        source = this.dailyFlagEvals;
        yAxisName = $localize`:@@workspace.usage.flag-evaluations:Flag Evaluations`;
        lineColor = '#025DF4';
        break;
      case 'customMetrics':
        source = this.dailyCustomMetrics;
        yAxisName = $localize`:@@workspace.usage.custom-metrics:Custom Metrics`;
        lineColor = '#FFC328';
        break;
      default:
        source = this.dailyDau;
        yAxisName = $localize`:@@workspace.usage.daily-new-users:Daily New Users`;
        lineColor = '#3CC798';
    }

    const hex = lineColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    this.chartConfig = {
      source: source as unknown as Data[],
      xAxis: {
        name: 'Date',
        field: 'date',
        position: 'bottom',
      },
      yAxis: {
        name: yAxisName,
        field: 'value',
        position: 'left',
        formatter: (val) => this.formatNumber(+val),
        scale: { min: 0 },
      },
      padding: [40, 40, 50, 70],
      lineColor,
      areaStyle: {
        fill: `l(270) 0:rgba(${r}, ${g}, ${b}, 0) 1:rgba(${r}, ${g}, ${b}, 0.6)`,
      },
    };
  }

  formatNumber(value: number): string {
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  }

  getChangePercent(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  getUsagePercent(envValue: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((envValue / total) * 1000) / 10;
  }

  sortByMau = (a: EnvironmentUsage, b: EnvironmentUsage) => a.mau - b.mau;
  sortByFlagEvals = (a: EnvironmentUsage, b: EnvironmentUsage) => a.flagEvaluations - b.flagEvaluations;
  sortByCustomMetrics = (a: EnvironmentUsage, b: EnvironmentUsage) => a.customMetrics - b.customMetrics;
}
