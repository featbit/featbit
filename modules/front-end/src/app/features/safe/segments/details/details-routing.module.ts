import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';


const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '用户组'
    },
    component: DetailsComponent,
    children: [
      {
        path: 'targeting',
        component: TargetingComponent,
        data: {
          breadcrumb: '用户组'
        }
      }, {
        path: '',
        redirectTo: '/segments',
        data: {
          breadcrumb: '用户组'
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
