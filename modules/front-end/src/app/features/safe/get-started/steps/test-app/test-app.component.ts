import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NzProgressStatusType } from "ng-zorro-antd/progress";
import { FeatureFlagService } from "@services/feature-flag.service";
import { IntervalType } from "@features/safe/feature-flags/details/insights/types";
import { getTimezoneString } from "@utils/index";
import { GET_STARTED } from "@utils/localstorage-keys";

@Component({
  selector: 'test-app',
  templateUrl: './test-app.component.html',
  styleUrls: ['./test-app.component.less']
})
export class TestAppComponent implements OnInit{

  @Input() flagKey: string = 'the-flag-key';

  @Output() onComplete = new EventEmitter<void>();
  @Output() onPrev = new EventEmitter<void>();

  private startTime: number;
  private progress: number = 0;
  normalizedProgress: number = 0;

  progressTimeout: number = 1000 * 30;
  progressRefreshInterval: number = 50;

  status: NzProgressStatusType;

  statusSuccess = 'success' as NzProgressStatusType;
  statusException = 'exception' as NzProgressStatusType;
  statusActive = 'active' as NzProgressStatusType;

  constructor(private featureFlagService: FeatureFlagService,) {
  }

  private refreshProgress() {
    if (this.status === this.statusSuccess) {
      this.progress = 100;
      this.normalizedProgress = 100;
    } else if(this.status === this.statusActive && this.progress < 100) {
      setTimeout(async () => {
        this.progress = Math.min(this.progress + this.progressRefreshInterval / this.progressTimeout * 100, 100);
        this.normalizedProgress = Math.trunc(this.progress);
        this.refreshProgress();
      }, this.progressRefreshInterval);
    } else {
      this.status = this.statusException;
    }
  }

  private refreshStatus() {
    if (this.status === this.statusActive && this.progress < 100) {
      setTimeout(async () => {
        const hasEvents = await this.flagHasEvents();
        if (hasEvents) {
          this.status = this.statusSuccess;
        } else {
          this.refreshStatus();
        }
      }, 5000);
    }
  }

  private flagHasEvents (): Promise<boolean> {
    return new Promise((resolve, reject) => {
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

  ngOnInit() {
    this.start();
  }

  start() {
    this.progress = 0;
    this.normalizedProgress = 0;
    this.status = this.statusActive;
    this.startTime = new Date().getTime();
    this.refreshStatus();
    this.refreshProgress();
  }

  startJourney() {
    localStorage.setItem(GET_STARTED(), 'true');
    this.onComplete.emit();
  }
}
