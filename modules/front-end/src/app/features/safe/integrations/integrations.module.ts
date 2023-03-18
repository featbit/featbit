import { NgModule } from '@angular/core';
import { IntegrationsRoutingModule } from './integrations-routing.module';
import { CommonModule } from '@angular/common';
import { IntegrationsComponent } from './integrations.component';
import { NzResultModule } from 'ng-zorro-antd/result';

@NgModule({
  declarations: [
    IntegrationsComponent
  ],
  imports: [
    CommonModule,
    NzResultModule,
    IntegrationsRoutingModule,
  ],
  exports: [
  ],
  providers: []
})
export class IntegrationsModule { }
