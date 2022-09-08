import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SwitchIndexRoutingModule } from './switch-index-routing.module';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { SwitchIndexComponent } from './switch-index.component';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule  } from 'ng-zorro-antd/modal';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { SwitchTagTreeViewComponent } from './switch-tag-tree-view.component';
import { NzTreeViewModule } from "ng-zorro-antd/tree-view";
import { NzTreeSelectModule } from "ng-zorro-antd/tree-select";
import { SwitchTagTreeSelectComponent } from './switch-tag-tree-select.component';
import { NzTransferModule } from "ng-zorro-antd/transfer";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzListModule } from "ng-zorro-antd/list";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzNotificationModule } from "ng-zorro-antd/notification";
import {CoreModule} from "@core/core.module";


@NgModule({
  declarations: [SwitchIndexComponent, SwitchTagTreeViewComponent, SwitchTagTreeSelectComponent],
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
    SwitchIndexRoutingModule,
    NzSwitchModule,
    NzIconModule,
    NzTreeViewModule,
    NzTreeSelectModule,
    NzTransferModule,
    NzTagModule,
    NzToolTipModule,
    NzFormModule,
    ReactiveFormsModule,
    CoreModule,
    NzDropDownModule,
    NzPopconfirmModule,
    NzListModule,
    NzAlertModule,
    NzCheckboxModule,
    NzNotificationModule
  ]
})
export class SwitchIndexModule { }
