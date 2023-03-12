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
        path: 'feature-flags',
        loadChildren: () => import("./feature-flags/feature-flags.module").then(m => m.FeatureFlagsModule),
        data: {
          breadcrumb: $localize `:@@feature-flags:Feature flags`
        },
      },
      {
        path: 'users',
        loadChildren: () => import("./end-users/end-users.module").then(m => m.EndUsersModule),
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
        path: 'audit-logs',
        loadChildren: () => import("./audit-logs/audit-logs.module").then(m => m.AuditLogsModule),
        data: {
          breadcrumb: $localize `:@@auditlogs.audit-logs:Audit logs`
        },
      },
      {
        path: 'organizations',
        loadChildren: () => import("./organizations/organizations.module").then(m => m.OrganizationsModule),
        data: {
          breadcrumb: $localize `:@@organization:Organization`
        },
      },
      {
        path: 'iam',
        canActivate: [IAMGuard],
        loadChildren: () => import("./iam/iam.module").then(m => m.IAMModule),
      },
      {
        path: 'integrations',
        loadChildren: () => import("./integrations/integrations.module").then(m => m.IntegrationsModule),
      },
      {
        path: '',
        redirectTo: '/feature-flags',
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
