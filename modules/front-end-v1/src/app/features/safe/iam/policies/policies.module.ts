import { NgModule } from '@angular/core';
import { PoliciesRoutingModule } from './policies-routing.module';
import { CommonModule } from '@angular/common';
import {PoliciesComponent} from "@features/safe/iam/policies/policies.component";

@NgModule({
  declarations: [
    PoliciesComponent
  ],
  imports: [
    CommonModule,
    PoliciesRoutingModule
  ],
  providers: [
  ]
})
export class PoliciesModule { }
