import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IAMComponent } from './iam.component';

const routes: Routes = [
  {
    path: '',
    component: IAMComponent,
    children: [
      {
        path: 'team',
        loadChildren: () => import("./team/team.module").then(m => m.TeamModule),
        data: {
          breadcrumb: $localize `:@@iam.routing.team:Team`
        },
      },
      {
        path: 'groups',
        loadChildren: () => import("./groups/groups.module").then(m => m.GroupsModule),
        data: {
          breadcrumb: $localize `:@@iam.routing.groups:Groups`
        },
      },
      {
        path: 'policies',
        loadChildren: () => import("./policies/policies.module").then(m => m.PoliciesModule),
        data: {
          breadcrumb: $localize `:@@iam.routing.policies:Policies`
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
