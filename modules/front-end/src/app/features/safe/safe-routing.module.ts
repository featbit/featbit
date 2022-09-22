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
        loadChildren: () => import("./switch-manage/switch-manage.module").then(m => m.SwitchManageModule)
      },
      {
        path: 'users',
        loadChildren: () => import("./users/users.module").then(m => m.UsersModule),
        data: {
          breadcrumb: $localize `:@@users:Users`
        },
      },
      {
        path: 'segments',
        loadChildren: () => import("./segments/segments.module").then(m => m.SegmentsModule),
        data: {
          breadcrumb: $localize `:@@segments:Segments`
        },
      },
      {
        path: 'switch-archive',
        loadChildren: () => import("./switch-archive/switch-archive.module").then(m => m.SwitchArchiveModule),
        data: {
          breadcrumb: $localize `:@@ff-archive:Archived feature flags`
        },
      },
      {
        path: 'experiments',
        loadChildren: () => import("./experiments/experiments.module").then(m => m.ExperimentsModule),
        data: {
          breadcrumb: $localize `:@@experiments:Experiments`
        },
      },
      {
        path: 'data-sync',
        loadChildren: () => import("./data-sync/data-sync.module").then(m => m.DataSyncModule),
        data: {
          breadcrumb: $localize `:@@data-sync:Data sync`
        },
      },
      {
        path: 'account-settings',
        loadChildren: () => import("./account-settings/account-settings.module").then(m => m.AccountSettingsModule),
        data: {
          breadcrumb: $localize `:@@organization:Organization`
        },
      },
      {
        path: 'iam',
        canActivate: [IAMGuard],
        loadChildren: () => import("./iam/iam.module").then(m => m.IAMModule),
        data: {
          breadcrumb: $localize `:@@iam:IAM`
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
