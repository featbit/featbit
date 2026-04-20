import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WorkspacesComponent } from './workspaces.component';
import { LicenseComponent } from "@features/safe/workspaces/license/license.component";
import { UsageComponent } from "@features/safe/workspaces/usage/usage.component";
import { GlobalUserComponent } from "@features/safe/workspaces/global-user/global-user.component";
import { BillingComponent } from "@features/safe/workspaces/billing/billing.component";

const routes: Routes = [
  {
    path: '',
    component: WorkspacesComponent,
    children: [
      {
        path: 'license',
        component: LicenseComponent,
        data: {
          breadcrumb: $localize`:@@workspace.routing.license:License`
        },
      }, {
        path: 'usage',
        component: UsageComponent,
        data: {
          breadcrumb: $localize`:@@workspace.routing.usage:Usage`
        }
      },{
        path: 'billing',
        component: BillingComponent,
        data: {
          breadcrumb: $localize`:@@workspace.routing.billing:Billing`
        }
      },{
        path: 'global-users',
        component: GlobalUserComponent,
        data: {
          breadcrumb: $localize`:@@workspace.routing.global-users:Global Users`
        }
      }, {
        path: '',
        redirectTo: '.',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WorkspacesRoutingModule { }
