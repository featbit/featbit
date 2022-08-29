import { NgModule } from '@angular/core';
import { InitializationRoutingModule } from './initialization-routing.module';
import { CommonModule } from '@angular/common';
import { InitializationComponent } from './initialization.component';
import { ShareModule } from 'src/app/share/share.module';
import { StepsComponent } from './steps/steps.component';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";

@NgModule({
  declarations: [
    InitializationComponent,
    StepsComponent
  ],
  imports: [
    ShareModule,
    CommonModule,
    NzStepsModule,
    NzButtonModule,
    NzInputModule,
    NzTypographyModule,
    InitializationRoutingModule,
    NzDividerModule,
    NzIconModule,
    NzToolTipModule
  ],
  providers: [
  ]
})
export class InitializationModule { }
