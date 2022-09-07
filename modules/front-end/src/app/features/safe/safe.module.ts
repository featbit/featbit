import { NgModule } from '@angular/core';
import { SafeRoutingModule } from './safe-routing.module';
import { SafeComponent } from './safe.component';
import { SharedModule } from '@shared/shared.module';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

@NgModule({
  declarations: [SafeComponent],
  imports: [
    SharedModule,
    NzBreadCrumbModule,
    SafeRoutingModule
  ],
  providers: [
  ]
})
export class SafeModule { }
