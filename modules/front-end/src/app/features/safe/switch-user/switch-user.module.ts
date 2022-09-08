import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SwitchUserRoutingModule } from './switch-user-routing.module';
import { SwitchUserComponent } from './switch-user.component';
import { UserDetailComponent } from './user-detail/user-detail.component';
import { UserListComponent } from './user-list/user-list.component';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FormsModule } from '@angular/forms';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SharedModule } from '@shared/shared.module';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzGridModule } from "ng-zorro-antd/grid";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import { NzDividerModule } from "ng-zorro-antd/divider";
import {CoreModule} from "@core/core.module";

@NgModule({
  declarations: [SwitchUserComponent, UserDetailComponent, UserListComponent],
    imports: [
      CommonModule,
      FormsModule,
      SharedModule,
      CoreModule,
      NzTableModule,
      NzInputModule,
      NzDrawerModule,
      NzButtonModule,
      NzSpinModule,
      SwitchUserRoutingModule,
      NzIconModule,
      NzGridModule,
      NzSelectModule,
      NzPopoverModule,
      NzToolTipModule,
      NzDividerModule
    ]
})
export class SwitchUserModule { }
