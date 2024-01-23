import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WebhooksRoutingModule } from './webhooks-routing.module';
import { IndexComponent } from './index/index.component';
import { CoreModule } from "@core/core.module";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzWaveModule } from "ng-zorro-antd/core/wave";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";

@NgModule({
  declarations: [
    IndexComponent
  ],
  imports: [
    CommonModule,
    WebhooksRoutingModule,
    CoreModule,
    NzInputModule,
    NzTableModule,
    NzIconModule,
    NzButtonModule,
    NzWaveModule,
    NzToolTipModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzDropDownModule
  ]
})
export class WebhooksModule { }
