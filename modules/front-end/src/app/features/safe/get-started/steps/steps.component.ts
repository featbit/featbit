import { Component } from '@angular/core';
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { Router } from "@angular/router";

@Component({
  selector: 'steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent {

  flag: IFeatureFlag;

  currentStep = 0;

  constructor(private router: Router) {
  }

  goPrev() {
    this.currentStep -= 1;
  }

  goNext() {
    this.currentStep += 1;
  }

  onStepChange(step: number): void {
    this.currentStep = step;
  }

  onFlagCreated(flag: IFeatureFlag) {
    this.flag = { ...flag };
    this.goNext();
  }

  navigateToFlagList() {
    this.router.navigateByUrl("/feature-flags").then();
  }
}
