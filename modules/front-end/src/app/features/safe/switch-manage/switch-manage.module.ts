import { NgModule } from '@angular/core';
import { SwitchManageRoutingModule } from './switch-manage-routing.module';
import { CommonModule } from '@angular/common';
import { SwitchManageComponent } from './switch-manage.component';


@NgModule({
  declarations: [
    SwitchManageComponent
  ],
  imports: [
    CommonModule,
    SwitchManageRoutingModule
  ],
  providers: [
  ]
})
export class SwitchManageModule { }
