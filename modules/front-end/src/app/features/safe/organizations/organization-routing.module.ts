import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';

const routes: Routes = [
  {
    path: '',
    component: OrganizationsComponent,
    children: [
      {
        path: 'projects',
        children: [],
        data: {
          breadcrumb: $localize`:@@organization.routing.projects:Projects`
        }
      },
      {
        path: 'profile',
        children: [],
        data: {
          breadcrumb: $localize`:@@organization.routing.profile:Profile`
        }
      },
      {
        path: '',
        redirectTo: '.',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganizationRoutingModule { }
