import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';
import { SettingComponent } from './setting/setting.component';
import {InsightsComponent} from "@features/safe/feature-flags/details/insights/insights.component";
import {AuditLogComponent} from "@core/components/audit-log/audit-log.component";


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
        path: 'insights',
        component: InsightsComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.insights:Insights`
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
        path: 'history',
        component: AuditLogComponent,
        data: {
          breadcrumb: $localize `:@@ff.routing.details.history:History`
        }
      }, {
        path: '',
        redirectTo: '/feature-flags',
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
