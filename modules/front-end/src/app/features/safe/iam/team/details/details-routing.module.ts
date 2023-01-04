import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { GroupsComponent } from './groups/groups.component';
import {DirectPoliciesComponent} from "@features/safe/iam/team/details/direct-policies/direct-policies.component";
import {InheritedPoliciesComponent} from "@features/safe/iam/team/details/inherited-policies/inherited-policies.component";

const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'groups',
        component: GroupsComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.groups:Groups`
        },
      }, {
        path: 'direct-policies',
        component: DirectPoliciesComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.direct-policies:Direct policies`
        },
      }, {
        path: 'inherited-policies',
        component: InheritedPoliciesComponent,
        data: {
          breadcrumb: $localize `:@@iam.routing.inherited-policies:Inherited-policies`
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
