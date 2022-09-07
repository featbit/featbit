import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IAMComponent } from './iam.component';

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理'
    },
    component: IAMComponent,
    children: [
      {
        path: 'users',
        loadChildren: () => import("./users/users.module").then(m => m.UsersModule),
        data: {
          breadcrumb: '权限管理 - 团队'
        },
      },
      {
        path: 'groups',
        loadChildren: () => import("./groups/groups.module").then(m => m.GroupsModule),
        data: {
          breadcrumb: '权限管理 - 组'
        },
      },
      {
        path: 'policies',
        loadChildren: () => import("./policies/policies.module").then(m => m.PoliciesModule),
        data: {
          breadcrumb: '权限管理 - 策略'
        },
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IAMRoutingModule { }
