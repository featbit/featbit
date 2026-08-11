import { NgModule } from '@angular/core';
import { SafeRoutingModule } from './safe-routing.module';
import { SafeComponent } from './safe.component';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { CoreModule } from "@core/core.module";
import { NzModalModule } from 'ng-zorro-antd/modal';
import { CompleteComponent } from "@features/safe/onboarding/complete/complete.component";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzTypographyModule } from 'ng-zorro-antd/typography';
@NgModule({
  declarations: [SafeComponent, CompleteComponent],
  imports: [
    CoreModule,
    NzBreadCrumbModule,
    NzModalModule,
    NzButtonModule,
    NzTypographyModule,
    SafeRoutingModule,
  ],
  providers: [
  ]
})
export class SafeModule { }
