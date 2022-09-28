import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationsComponent } from './organizations.component';
import { OrganizationComponent  } from './organization/organization.component';
import { ProfileComponent } from './profile/profile.component';
import { ProjectComponent } from './project/project.component';

const routes: Routes = [
  {
    path: '',
    component: OrganizationsComponent,
    children: [
      {
        path: '',
        component: OrganizationComponent
      }, {
        path: 'projects',
        component: ProjectComponent,
      }, {
        path: 'profile',
        component: ProfileComponent,
      }, {
        path: '',
        redirectTo: './org',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganizationsRoutingModule { }
