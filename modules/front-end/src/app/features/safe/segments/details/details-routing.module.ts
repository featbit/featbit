import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';
import {AuditLogComponent} from "@core/components/audit-log/audit-log.component";


const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'targeting',
        component: TargetingComponent,
      }, {
        path: 'history',
        component: AuditLogComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.history:History`
        }
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
