import { NgModule } from '@angular/core';
import { FeatureFlagsRoutingModule } from './feature-flags-routing.module';
import { CommonModule } from '@angular/common';
import { FeatureFlagsComponent } from './feature-flags.component';


@NgModule({
  declarations: [
    FeatureFlagsComponent
  ],
  imports: [
    CommonModule,
    FeatureFlagsRoutingModule
  ],
  providers: [
  ]
})
export class FeatureFlagsModule { }
