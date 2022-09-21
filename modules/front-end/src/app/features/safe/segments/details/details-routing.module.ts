import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';


const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'targeting',
        component: TargetingComponent,
      }, {
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
export class DetailsRoutingModule { }
