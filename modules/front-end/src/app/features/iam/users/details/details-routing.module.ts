import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { GroupsComponent } from './groups/groups.component';
import {DirectPoliciesComponent} from "@features/iam/users/details/direct-policies/direct-policies.component";
import {InheritedPoliciesComponent} from "@features/iam/users/details/inherited-policies/inherited-policies.component";

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '权限管理 - 团队'
    },
    component: DetailsComponent,
    children: [
      {
        path: 'groups',
        component: GroupsComponent,
        data: {
          breadcrumb: '权限管理 - 团队'
        }
      }, {
        path: 'direct-policies',
        component: DirectPoliciesComponent,
        data: {
          breadcrumb: '权限管理 - 团队'
        }
      }, {
        path: 'inherited-policies',
        component: InheritedPoliciesComponent,
        data: {
          breadcrumb: '权限管理 - 团队'
        }
      }, {
        path: '',
        redirectTo: '/iam',
        data: {
          breadcrumb: '权限管理'
        }
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
