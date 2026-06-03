import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

type ExperimentPageMode = 'old' | 'new' | 'allow-switch';

@Component({
    selector: 'app-experiments',
    templateUrl: './experiments.component.html',
    styleUrls: ['./experiments.component.less'],
    standalone: false
})
export class ExperimentsComponent implements OnInit {
  mode: ExperimentPageMode = 'old';
  showVersionChoice = false;

  ngOnInit() {
    this.mode = this.normalizeExperimentPageMode(environment.experimentPageMode);

    if (this.mode === 'new') {
      this.openNewVersion();
      return;
    }

    this.showVersionChoice = this.mode === 'allow-switch';
  }

  keepOldVersion() {
    this.showVersionChoice = false;
  }

  openNewVersion() {
    window.location.assign('/release-decision');
  }

  private normalizeExperimentPageMode(value: string): ExperimentPageMode {
    if (value === 'new' || value === 'allow-switch') {
      return value;
    }

    return 'old';
  }
}
