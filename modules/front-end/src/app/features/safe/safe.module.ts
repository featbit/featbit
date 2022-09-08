import { NgModule } from '@angular/core';
import { SafeRoutingModule } from './safe-routing.module';
import { SafeComponent } from './safe.component';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import {CoreModule} from "@core/core.module";

@NgModule({
  declarations: [SafeComponent],
  imports: [
    CoreModule,
    NzBreadCrumbModule,
    SafeRoutingModule
  ],
  providers: [
  ]
})
export class SafeModule { }
