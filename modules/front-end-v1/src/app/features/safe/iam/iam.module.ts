import { NgModule } from '@angular/core';
import { IAMRoutingModule } from './iam-routing.module';
import { CommonModule } from '@angular/common';
import { IAMComponent } from './iam.component';
import { NzResultModule } from 'ng-zorro-antd/result';

@NgModule({
  declarations: [
    IAMComponent
  ],
  imports: [
    CommonModule,
    NzResultModule,
    IAMRoutingModule,
  ],
  exports: [
  ],
  providers: []
})
export class IAMModule { }
