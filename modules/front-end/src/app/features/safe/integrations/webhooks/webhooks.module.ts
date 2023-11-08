import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WebhooksRoutingModule } from './webhooks-routing.module';
import { IndexComponent } from './index/index.component';

@NgModule({
  declarations: [
    IndexComponent
  ],
  imports: [
    CommonModule,
    WebhooksRoutingModule
  ]
})
export class WebhooksModule { }
