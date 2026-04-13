import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WorkspacesComponent } from './workspaces.component';
import { LicenseComponent } from "@features/safe/workspaces/license/license.component";
import { GlobalUserComponent } from "@features/safe/workspaces/global-user/global-user.component";

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
