import { NgModule } from '@angular/core';
import { OnboardingRoutingModule } from './onboarding-routing.module';
import { CommonModule } from '@angular/common';
import { OnboardingComponent } from './onboarding.component';
import { StepsComponent } from './steps/steps.component';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import {CoreModule} from "@core/core.module";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzGridModule } from "ng-zorro-antd/grid";

@NgModule({
  declarations: [
    OnboardingComponent,
    StepsComponent
  ],
  imports: [
    CoreModule,
    CommonModule,
    NzStepsModule,
    NzButtonModule,
    NzInputModule,
    NzTypographyModule,
    OnboardingRoutingModule,
    NzDividerModule,
    NzIconModule,
    NzToolTipModule,
    NzFormModule,
    NzGridModule
  ],
  providers: [
  ]
})
export class OnboardingModule { }
