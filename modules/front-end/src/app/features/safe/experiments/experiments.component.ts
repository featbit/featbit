import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-experiments',
    templateUrl: './experiments.component.html',
    standalone: false
})
export class ExperimentsComponent implements OnInit {
  ngOnInit() {
    if (environment.featureFlagInsightsProvider === 'featbit-api') {
      this.openNewVersion();
    }
  }

  openNewVersion() {
    window.location.assign('/release-decision/');
  }
}
