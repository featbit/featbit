import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExperimentsComponent } from './experiments.component';
import { MetricsComponent } from './metrics/metrics.component';
import { OverviewComponent } from './overview/overview.component';


const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '数据实验'
    },
    component: ExperimentsComponent,
    children: [
      {
        path: 'overview',
        component: OverviewComponent,
        data: {
          breadcrumb: '数据实验'
        },
      }, {
        path: 'metrics',
        component: MetricsComponent,
        data: {
          breadcrumb: '数据实验'
        },
      }, {
        path: '',
        redirectTo: '/experiments'
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
export class ExperimentsRoutingModule { }
