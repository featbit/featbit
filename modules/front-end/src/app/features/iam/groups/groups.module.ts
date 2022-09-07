import { NgModule } from '@angular/core';
import { GroupsRoutingModule } from './groups-routing.module';
import { CommonModule } from '@angular/common';
import {GroupsComponent} from "@features/iam/groups/groups.component";

@NgModule({
  declarations: [
    GroupsComponent
  ],
  imports: [
    CommonModule,
    GroupsRoutingModule
  ],
  providers: [
  ]
})
export class GroupsModule { }
