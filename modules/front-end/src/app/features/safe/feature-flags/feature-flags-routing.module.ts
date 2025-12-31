import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeatureFlagsComponent } from './feature-flags.component';

const routes: Routes = [
  {
    path: '',
    component: FeatureFlagsComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule)
      },
      {
        path: 'compare',
        loadComponent: () => import("./compare/compare.component").then(m => m.CompareComponent),
        data: {
          breadcrumb: $localize `:@@common.compare:Compare`
        }
      },
      {
        path: ':key',
        loadChildren: () => import("./details/details.module").then(m => m.DetailsModule),
      },
      {
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
export class FeatureFlagsRoutingModule { }
