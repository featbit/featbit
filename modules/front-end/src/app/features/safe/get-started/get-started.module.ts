import { NgModule } from '@angular/core';
import { GetStartedRoutingModule } from './get-started-routing.module';
import { CommonModule } from '@angular/common';
import { GetStartedComponent } from './get-started.component';
import { StepsComponent } from './steps/steps.component';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import {CoreModule} from "@core/core.module";
import { RecapComponent } from "@features/safe/get-started/recap/recap.component";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";

@NgModule({
  declarations: [
    GetStartedComponent,
    StepsComponent,
    RecapComponent
  ],
    imports: [
        CoreModule,
        CommonModule,
        NzStepsModule,
        NzButtonModule,
        NzInputModule,
        NzTypographyModule,
        GetStartedRoutingModule,
        NzDividerModule,
        NzIconModule,
        NzToolTipModule,
        NzCardModule,
        NzDescriptionsModule
    ],
  providers: [
  ]
})
export class GetStartedModule { }