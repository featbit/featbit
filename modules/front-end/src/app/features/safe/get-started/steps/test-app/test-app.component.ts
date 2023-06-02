import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NzProgressStatusType } from "ng-zorro-antd/progress";
import { FeatureFlagService } from "@services/feature-flag.service";
import { IntervalType } from "@features/safe/feature-flags/details/insights/types";
import { getTimezoneString } from "@utils/index";

@Component({
  selector: 'test-app',
  templateUrl: './test-app.component.html',
  styleUrls: ['./test-app.component.less']
})
export class TestAppComponent implements OnInit, OnDestroy {

  @Input() flagKey: string = 'the-flag-key';

  @Output() onComplete = new EventEmitter<void>();
  @Output() onPrev = new EventEmitter<void>();

  private startTime: number;
  private progress: number = 0;
  normalizedProgress: number = 0;

  progressTimeout: number = 1000 * 120;
  progressRefreshInterval: number = 50;

  status: NzProgressStatusType;

  statusSuccess = 'success' as NzProgressStatusType;
  statusException = 'exception' as NzProgressStatusType;
  statusActive = 'active' as NzProgressStatusType;

  updateProgressTimer: number;
  updateStatusTimer: number;

  constructor(private featureFlagService: FeatureFlagService) {
  }

  ngOnInit() {
    this.start();
  }

  start() {
    this.progress = 0;
    this.normalizedProgress = 0;
    this.status = this.statusActive;
    this.startTime = new Date().getTime();
    this.startRefreshStatus();
    this.startRefreshProgress();
  }

  ngOnDestroy(): void {
    clearTimeout(this.updateProgressTimer);
    clearTimeout(this.updateStatusTimer);
  }

  private startRefreshProgress() {
    if (this.status === this.statusSuccess) {
      this.progress = 100;
      this.normalizedProgress = 100;
    } else if (this.status === this.statusActive && this.progress < 100) {
      // The warning is nodejs related, it's incorrect, it's ignored
      // @ts-ignore
      this.updateProgressTimer = setTimeout(async () => {
        this.progress = Math.min(this.progress + this.progressRefreshInterval / this.progressTimeout * 100, 100);
        this.normalizedProgress = Math.trunc(this.progress);
        this.startRefreshProgress();
      }, this.progressRefreshInterval);
    } else {
      this.status = this.statusException;
    }
  }

  private startRefreshStatus() {
    if (!this.flagKey) {
      return;
    }

    if (this.status === this.statusActive && this.progress < 100) {
      // The warning is nodejs related, it's incorrect, it's ignored
      // @ts-ignore
      this.updateStatusTimer = setTimeout(async () => {
        const hasEvents = await this.flagHasEvents();
        if (hasEvents) {
          this.status = this.statusSuccess;
        } else {
          this.startRefreshStatus();
        }
      }, 5000);
    }
  }

  private flagHasEvents(): Promise<boolean> {
    return new Promise((resolve, _) => {
      const filter = {
        featureFlagKey: this.flagKey,
        intervalType: IntervalType.Minute,
        from: this.startTime,
        to: new Date().getTime(),
        timezone: getTimezoneString()
      };

      this.featureFlagService.getInsights(filter).subscribe({
        next: (result) => {
          const hasEvents = result.flatMap((i) => i.variations.map((v) => v.count)).some((count) => count > 0);

          resolve(hasEvents);
        },
        error: () => {
          resolve(false);
        }
      })
    });
  }
}
