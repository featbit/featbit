import { NgModule } from '@angular/core';
import { CompareAndCopyRoutingModule } from './compare-and-copy-routing.module';
import { CommonModule } from '@angular/common';
import { CompareAndCopyComponent } from './compare-and-copy.component';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzGridModule } from 'ng-zorro-antd/grid';


@NgModule({
  declarations: [
    CompareAndCopyComponent
  ],
  imports: [
    CommonModule,
    CompareAndCopyRoutingModule,
    NzResultModule,
    NzGridModule
  ],
  providers: [
  ]
})
export class CompareAndCopyModule { }