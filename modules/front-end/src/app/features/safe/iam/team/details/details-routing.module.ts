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
        component: GroupsComponent
      }, {
        path: 'direct-policies',
        component: DirectPoliciesComponent
      }, {
        path: 'inherited-policies',
        component: InheritedPoliciesComponent
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
