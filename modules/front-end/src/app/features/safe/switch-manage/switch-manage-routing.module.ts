import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SwitchManageComponent } from './switch-manage.component';

const routes: Routes = [
  {
    path: '',
    component: SwitchManageComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./switch-index/switch-index.module").then(m => m.SwitchIndexModule)
      },
      {
        path: ':id',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
      },
      {
        path: '',
        redirectTo: '/switch-manage',
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
export class SwitchManageRoutingModule { }
