import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataSyncComponent } from './data-sync.component';
import { DataSyncRoutingModule } from './data-sync-routing.module';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from "ng-zorro-antd/input";
import { NzTypographyModule } from "ng-zorro-antd/typography";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzCardModule } from 'ng-zorro-antd/card';
import { RemoteSyncComponent } from './remote-sync/remote-sync.component';
import { LocalSyncComponent } from './local-sync/local-sync.component';
import { NzAlertModule } from "ng-zorro-antd/alert";
import {CoreModule} from "@core/core.module";

@NgModule({
  declarations: [DataSyncComponent, RemoteSyncComponent, LocalSyncComponent],
  imports: [
    CommonModule,
    FormsModule,
    NzSpinModule,
    NzButtonModule,
    NzMessageModule,
    NzListModule,
    NzSpaceModule,
    NzDividerModule,
    NzIconModule,
    NzDatePickerModule,
    CoreModule,
    DataSyncRoutingModule,
    NzFormModule,
    NzInputModule,
    NzTypographyModule,
    NzTableModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzToolTipModule,
    NzTabsModule,
    NzAlertModule,
    NzCardModule
  ]
})
export class DataSyncModule { }
