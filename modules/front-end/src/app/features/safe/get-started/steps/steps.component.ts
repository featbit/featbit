import { Component } from '@angular/core';
import { Router } from "@angular/router";
import { IFeatureFlagListItem } from "@features/safe/feature-flags/types/feature-flag";

@Component({
  selector: 'steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent {

  flag: IFeatureFlagListItem;

  currentStep = 0;

  constructor(private router: Router) {
  }

  goPrev() {
    this.currentStep -= 1;
  }

  goNext() {
    this.currentStep += 1;
  }

  onFlagCreated(flag: IFeatureFlagListItem) {
    this.flag = { ...flag };
    this.goNext();
  }

  navigateToFlagList() {
    this.router.navigateByUrl("/feature-flags").then();
  }
}
