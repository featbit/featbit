import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LoginRoutingModule } from './login-routing.module';
import { LoginComponent } from './login.component';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { RegisterComponent } from './register/register.component';
import { ForgetComponent } from './forget/forget.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DoLoginComponent } from './do-login/do-login.component';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzIconModule } from "ng-zorro-antd/icon";
import { PhoneCodeFormComponent } from './phone-code-form/phone-code-form.component';
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzDividerModule } from "ng-zorro-antd/divider";


@NgModule({
  declarations: [LoginComponent, RegisterComponent, ForgetComponent, DoLoginComponent, PhoneCodeFormComponent],
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
    NzDividerModule
  ]
})
export class LoginModule { }
