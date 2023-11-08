import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WorkspacesComponent } from './workspaces.component';
import { OrganizationComponent  } from './organization/organization.component';
import { ProfileComponent } from './profile/profile.component';
import { ProjectComponent } from './project/project.component';

const routes: Routes = [
  {
    path: '',
    component: WorkspacesComponent,
    children: [
      {
        path: 'organization',
        component: OrganizationComponent
      }, {
        path: 'projects',
        component: ProjectComponent,
        data: {
          breadcrumb: $localize `:@@org.routing.projects:Projects`
        },
      }, {
        path: 'profile',
        component: ProfileComponent,
        data: {
          breadcrumb: $localize `:@@org.routing.profile:Profile`
        },
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
export class WorkspacesRoutingModule { }
