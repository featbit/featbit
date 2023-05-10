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
import { CoreModule } from "@core/core.module";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { ConnectAnSdkComponent } from './steps/connect-an-sdk/connect-an-sdk.component';
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from "ng-zorro-antd/select";
import {
  CreateFeatureFlagComponent
} from "@features/safe/get-started/steps/create-feature-flag/create-feature-flag.component";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzSkeletonModule } from "ng-zorro-antd/skeleton";
import { TestAppComponent } from "@features/safe/get-started/steps/test-app/test-app.component";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { NzPageHeaderModule } from "ng-zorro-antd/page-header";

@NgModule({
  declarations: [
    GetStartedComponent,
    StepsComponent,
    ConnectAnSdkComponent,
    CreateFeatureFlagComponent,
    TestAppComponent
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
    NzDescriptionsModule,
    NzTabsModule,
    NzTagModule,
    NzSelectModule,
    NzFormModule,
    NzSkeletonModule,
    NzProgressModule,
    NzPageHeaderModule
  ],
  providers: []
})
export class GetStartedModule { }
