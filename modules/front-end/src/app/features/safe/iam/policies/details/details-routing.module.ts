import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TeamComponent } from './team/team.component';
import {GroupsComponent} from "@features/safe/iam/policies/details/groups/groups.component";
import {PermissionComponent} from "@features/safe/iam/policies/details/permission/permission.component";

const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'permission',
        component: PermissionComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.permissions:Permissions`
        },
      }, {
        path: 'team',
        component: TeamComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.team:Team`
        },
      }, {
        path: 'groups',
        component: GroupsComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.groups:Groups`
        },
      }, {
        path: '',
        redirectTo: '/iam',
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
export class DetailsRoutingModule { }
