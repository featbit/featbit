import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { UsersComponent } from './users/users.component';
import {PoliciesComponent} from "@features/safe/iam/groups/details/policies/policies.component";

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 组'
    },
    component: DetailsComponent,
    children: [
      {
        path: 'users',
        component: UsersComponent,
        data: {
          breadcrumb: '权限管理 - 组'
        }
      }, {
        path: 'policies',
        component: PoliciesComponent,
        data: {
          breadcrumb: '权限管理 - 组'
        }
      }, {
        path: '',
        redirectTo: '/iam',
        data: {
          breadcrumb: '权限管理'
        },
        pathMatch: 'full'
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
