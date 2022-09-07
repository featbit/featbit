import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {UsersComponent} from "@features/iam/users/users.component";

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 团队'
    },
    component: UsersComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule),
        data: {
          breadcrumb: '权限管理 - 团队'
        }
      },
      {
        path: ':id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
        data: {
          breadcrumb: '权限管理 - 团队'
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
export class UsersRoutingModule { }
