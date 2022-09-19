import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TeamComponent } from './team/team.component';
import {PoliciesComponent} from "@features/safe/iam/groups/details/policies/policies.component";

const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'team',
        component: TeamComponent,
      }, {
        path: 'policies',
        component: PoliciesComponent,
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
