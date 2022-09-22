import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {GroupsComponent} from "@features/safe/iam/groups/groups.component";


const routes: Routes = [
  {
    path: '',
    component: GroupsComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule),
      },
      {
        path: ':id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
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
export class GroupsRoutingModule { }
