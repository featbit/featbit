import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NzProgressStatusType } from "ng-zorro-antd/progress";

@Component({
  selector: 'test-app',
  templateUrl: './test-app.component.html',
  styleUrls: ['./test-app.component.less']
})
export class TestAppComponent implements OnInit{

  @Input() flagKey: string = 'the-flag-key';

  @Output() onComplete = new EventEmitter<void>();
  @Output() onPrev = new EventEmitter<void>();

  private progress: number = 0;
  normalizedProgress: number = 0;

  progressTimeout: number = 1000 * 30;
  progressRefreshInterval: number = 50;

  status: NzProgressStatusType;

  statusSuccess = 'success' as NzProgressStatusType;
  statusException = 'exception' as NzProgressStatusType;
  statusActive = 'active' as NzProgressStatusType;

  constructor() {
  }

  private refreshProgress() {
    if (this.status === this.statusSuccess) {
      this.progress = 100;
      this.normalizedProgress = 100;
    } else if(this.status === this.statusActive && this.progress < 100) {
      setTimeout(async () => {
        try {
          await this.fetchFlagEvents();
          this.status = this.statusSuccess;
        } catch (e) {
          this.progress = Math.min(this.progress + this.progressRefreshInterval / this.progressTimeout * 100, 100);
          this.normalizedProgress = Math.trunc(this.progress);
        }

        this.refreshProgress();
      }, this.progressRefreshInterval);
    } else {
      this.status = this.statusException;
    }
  }

  private async fetchFlagEvents () {
    return new Promise((resolve, reject) => {
      //resolve(null);
      reject();
    });
  }

  ngOnInit() {
    this.start()
  }

  start() {
    this.progress = 0;
    this.normalizedProgress = 0;
    this.status = this.statusActive;
    this.refreshProgress();
  }
}
