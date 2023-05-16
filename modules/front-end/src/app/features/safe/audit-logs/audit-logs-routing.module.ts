import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuditLogsComponent } from './audit-logs.component';

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: $localize `:@@auditlogs.audit-logs:Audit Logs`
    },
    component: AuditLogsComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule)
      },
      {
        path: '',
        redirectTo: '/audit-logs',
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
export class AuditLogsRoutingModule { }
