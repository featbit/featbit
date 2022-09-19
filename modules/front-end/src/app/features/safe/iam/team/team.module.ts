import { NgModule } from '@angular/core';
import { TeamRoutingModule } from './team-routing.module';
import { CommonModule } from '@angular/common';
import {TeamComponent} from "@features/safe/iam/team/team.component";
import {RouterModule} from "@angular/router";

@NgModule({
  declarations: [
    TeamComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    TeamRoutingModule
  ],
  providers: [
  ]
})
export class TeamModule { }
