import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {PoliciesComponent} from "@features/iam/policies/policies.component";

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 策略'
    },
    component: PoliciesComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule),
        data: {
          breadcrumb: '权限管理 - 策略'
        }
      },
      {
        path: ':id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
        data: {
          breadcrumb: '权限管理 - 策略'
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
export class PoliciesRoutingModule { }
