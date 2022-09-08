import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SegmentsComponent } from './segments.component';

const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '用户组'
    },
    component: SegmentsComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule)
      },
      {
        path: 'details/:id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
        data: {
          breadcrumb: '用户组'
        }
      },
      {
        path: '',
        redirectTo: '/segments',
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
export class SegmentsRoutingModule { }
