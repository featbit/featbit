import { NgModule } from '@angular/core';
import { IndexRoutingModule } from './index-routing.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageModule } from 'ng-zorro-antd/message';

import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {IndexComponent} from "@features/safe/integrations/access-tokens/index/index.component";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {CoreModule} from "@core/core.module";


@NgModule({
  declarations: [
    IndexComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    NzSpinModule,
    NzSelectModule,
    NzEmptyModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CoreModule,
    NzMessageModule,
    NzDropDownModule,
    NzToolTipModule,
    NzDividerModule,
    NzPopconfirmModule,
    IndexRoutingModule,
    CoreModule
  ],
  providers: [
  ]
})
export class IndexModule { }
