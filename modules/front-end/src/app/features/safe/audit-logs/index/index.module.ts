import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexRoutingModule } from './index-routing.module';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { IndexComponent } from './index.component';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule  } from 'ng-zorro-antd/modal';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTreeViewModule } from "ng-zorro-antd/tree-view";
import { NzTreeSelectModule } from "ng-zorro-antd/tree-select";
import { NzTransferModule } from "ng-zorro-antd/transfer";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzFormModule } from "ng-zorro-antd/form";
import {CoreModule} from "@core/core.module";
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import {NzListModule} from "ng-zorro-antd/list";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzDescriptionsModule} from "ng-zorro-antd/descriptions";
import {AuditLogsModule} from "@features/safe/audit-logs/audit-logs.module";
import {DetailsModule} from "@features/safe/feature-flags/details/details.module";
import {NzTimelineModule} from "ng-zorro-antd/timeline";

@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    NzSelectModule,
    NzInputModule,
    NzButtonModule,
    NzGridModule,
    NzModalModule,
    NzMessageModule,
    FormsModule,
    NzTableModule,
    NzSpinModule,
    IndexRoutingModule,
    NzSwitchModule,
    NzIconModule,
    NzTreeViewModule,
    NzTreeSelectModule,
    NzTransferModule,
    NzTagModule,
    NzToolTipModule,
    NzFormModule,
    NzDatePickerModule,
    ReactiveFormsModule,
    CoreModule,
    NzListModule,
    NzCardModule,
    NzDescriptionsModule,
    AuditLogsModule,
    NzTimelineModule
  ]
})
export class IndexModule { }
