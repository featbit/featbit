import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WebhooksRoutingModule } from './webhooks-routing.module';
import { WebhooksComponent } from './webhooks.component';

@NgModule({
  declarations: [
    WebhooksComponent
  ],
  imports: [
    CommonModule,
    WebhooksRoutingModule
  ]
})
export class WebhooksModule { }
