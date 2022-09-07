import { NgModule } from '@angular/core';
import { UsersRoutingModule } from './users-routing.module';
import { CommonModule } from '@angular/common';
import {UsersComponent} from "@features/safe/iam/users/users.component";
import {RouterModule} from "@angular/router";

@NgModule({
  declarations: [
    UsersComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    UsersRoutingModule
  ],
  providers: [
  ]
})
export class UsersModule { }
