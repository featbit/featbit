import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IAMComponent } from './iam.component';

const routes: Routes = [
  {
    path: '',
    component: IAMComponent,
    children: [
      {
        path: 'users',
        loadChildren: () => import("./team/team.module").then(m => m.TeamModule),
        data: {
          breadcrumb: $localize `:@@ff.routing.team.pageTitle:IAM - Team`
        },
      },
      {
        path: 'groups',
        loadChildren: () => import("./groups/groups.module").then(m => m.GroupsModule),
        data: {
          breadcrumb: $localize `:@@ff.routing.groups.pageTitle:IAM - Groups`
        },
      },
      {
        path: 'policies',
        loadChildren: () => import("./policies/policies.module").then(m => m.PoliciesModule),
        data: {
          breadcrumb: $localize `:@@ff.routing.policies.pageTitle:IAM - Policies`
        },
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IAMRoutingModule { }
