import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details.component';
import { TargetingComponent } from './targeting/targeting.component';
import { SettingComponent } from './setting/setting.component';


const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '开关管理'
    },
    component: DetailsComponent,
    children: [
      {
        path: 'targeting',
        component: TargetingComponent,
        data: {
          breadcrumb: '目标条件'
        }
      }, {
        path: 'zero-code-settings',
        component: SettingComponent,
        data: {
          breadcrumb: '零代码'
        }
      }, {
        path: 'reporting',
        component: SettingComponent,
        data: {
          breadcrumb: '统计报表'
        }
      }, {
        path: 'triggers',
        component: SettingComponent,
        data: {
          breadcrumb: '触发器'
        }
      }, {
        path: 'experimentations',
        component: SettingComponent,
        data: {
          breadcrumb: '数据实验'
        }
      }, {
        path: 'flag-code-reference',
        component: SettingComponent,
        data: {
          breadcrumb: '代码引用管理'
        }
      }, {
        path: '',
        redirectTo: '/switch-manage',
        data: {
          breadcrumb: '开关管理'
        },
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
