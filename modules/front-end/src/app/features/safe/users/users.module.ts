import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';
import { DetailsComponent } from './details/details.component';
import { IndexComponent } from './index/index.component';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FormsModule } from '@angular/forms';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzGridModule } from "ng-zorro-antd/grid";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import { NzDividerModule } from "ng-zorro-antd/divider";
import {CoreModule} from "@core/core.module";

@NgModule({
  declarations: [UsersComponent, DetailsComponent, IndexComponent],
    imports: [
      CommonModule,
      FormsModule,
      CoreModule,
      NzTableModule,
      NzInputModule,
      NzDrawerModule,
      NzButtonModule,
      NzSpinModule,
      UsersRoutingModule,
      NzIconModule,
      NzGridModule,
      NzSelectModule,
      NzPopoverModule,
      NzToolTipModule,
      NzDividerModule
    ]
})
export class UsersModule { }
