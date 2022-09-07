import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SafeComponent } from './safe.component';
import {IAMGuard} from "@core/guards/iam.guard";

const routes: Routes = [
  {
    path: '',
    component: SafeComponent,
    children: [
      {
        path: 'account-settings',
        loadChildren: () => import("./account-settings/account-settings.module").then(m => m.AccountSettingsModule),
        data: {
          breadcrumb: '组织机构'
        },
      },
      {
        path: 'iam',
        canActivate: [IAMGuard],
        loadChildren: () => import("./iam/iam.module").then(m => m.IAMModule),
        data: {
          breadcrumb: '角色&权限'
        },
      },
      {
        path: '',
        redirectTo: '/account-settings',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SafeRoutingModule { }
