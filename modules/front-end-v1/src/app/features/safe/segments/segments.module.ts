import { NgModule } from '@angular/core';
import { SegmentsRoutingModule } from './segments-routing.module';
import { CommonModule } from '@angular/common';
import { SegmentsComponent } from './segments.component';


@NgModule({
  declarations: [
    SegmentsComponent
  ],
  imports: [
    CommonModule,
    SegmentsRoutingModule
  ],
  providers: [
  ]
})
export class SegmentsModule { }
