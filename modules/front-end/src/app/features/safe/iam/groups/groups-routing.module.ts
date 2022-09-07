import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {GroupsComponent} from "@features/safe/iam/groups/groups.component";


const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 组'
    },
    component: GroupsComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule),
        data: {
          breadcrumb: '权限管理 - 组'
        }
      },
      {
        path: ':id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
        data: {
          breadcrumb: '权限管理 - 组'
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
export class GroupsRoutingModule { }
