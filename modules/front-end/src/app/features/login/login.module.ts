import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LoginRoutingModule } from './login-routing.module';
import { LoginComponent } from './login.component';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DoLoginComponent } from './do-login/do-login.component';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { CoreModule } from "@core/core.module";
import { NzSpinModule } from "ng-zorro-antd/spin";

@NgModule({
  declarations: [LoginComponent, DoLoginComponent],
  imports: [
    CommonModule,
    NzGridModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzMessageModule,
    ReactiveFormsModule,
    LoginRoutingModule,
    NzTabsModule,
    NzIconModule,
    NzToolTipModule,
    FormsModule,
    NzDividerModule,
    CoreModule,
    NzSpinModule,
  ]
})
export class LoginModule { }
