import { NgModule } from '@angular/core';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { CommonModule } from '@angular/common';
import { NzResultModule } from 'ng-zorro-antd/result';

@NgModule({
  imports: [
    CommonModule,
    NzResultModule,
    IntegrationsRoutingModule,
  ]
})
export class IntegrationsModule { }
