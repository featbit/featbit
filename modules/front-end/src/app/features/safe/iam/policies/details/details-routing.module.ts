import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { UsersComponent } from './users/users.component';
import {GroupsComponent} from "@features/safe/iam/policies/details/groups/groups.component";
import {PermissionComponent} from "@features/safe/iam/policies/details/permission/permission.component";

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 策略'
    },
    component: DetailsComponent,
    children: [
      {
        path: 'permission',
        component: PermissionComponent,
        data: {
          breadcrumb: '权限管理 - 策略'
        }
      }, {
        path: 'users',
        component: UsersComponent,
        data: {
          breadcrumb: '权限管理 - 策略'
        }
      }, {
        path: 'groups',
        component: GroupsComponent,
        data: {
          breadcrumb: '权限管理 - 策略'
        }
      }, {
        path: '',
        redirectTo: '/iam',
        data: {
          breadcrumb: '权限管理'
        }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class DetailsRoutingModule { }
