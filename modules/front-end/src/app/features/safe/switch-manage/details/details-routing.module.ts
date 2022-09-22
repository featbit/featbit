import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';
import { SettingComponent } from './setting/setting.component';


const routes: Routes = [
  {
    path: '',
    component: DetailsComponent,
    children: [
      {
        path: 'targeting',
        component: TargetingComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.targeting:Targeting`
        }
      }, {
        path: 'reporting',
        component: SettingComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.reporting:Reporting`
        }
      }, {
        path: 'triggers',
        component: SettingComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.triggers:Triggers`
        }
      }, {
        path: 'experimentations',
        component: SettingComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.experimentation:Experimentation`
        }
      }, {
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
export class DetailsRoutingModule { }
