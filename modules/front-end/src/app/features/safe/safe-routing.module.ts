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
        path: 'switch-manage',
        loadChildren: () => import("./switch-manage/switch-manage.module").then(m => m.SwitchManageModule),
        data: {
          breadcrumb: '开关管理'
        },
      },
      {
        path: 'switch-user',
        loadChildren: () => import("./switch-user/switch-user.module").then(m => m.SwitchUserModule),
        data: {
          breadcrumb: '开关用户管理'
        },
      },
      {
        path: 'segments',
        loadChildren: () => import("./segments/segments.module").then(m => m.SegmentsModule),
        data: {
          breadcrumb: '用户组'
        },
      },
      {
        path: 'switch-archive',
        loadChildren: () => import("./switch-archive/switch-archive.module").then(m => m.SwitchArchiveModule),
        data: {
          breadcrumb: '开关存档'
        },
      },
      {
        path: 'experiments',
        loadChildren: () => import("./experiments/experiments.module").then(m => m.ExperimentsModule),
        data: {
          breadcrumb: '数据实验'
        },
      },
      {
        path: 'data-sync',
        loadChildren: () => import("./data-sync/data-sync.module").then(m => m.DataSyncModule),
        data: {
          breadcrumb: '数据同步'
        },
      },
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
        redirectTo: '/switch-manage',
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
