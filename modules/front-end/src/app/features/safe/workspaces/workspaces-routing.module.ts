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
        component: OrganizationComponent,
        data: {
          breadcrumb: $localize `:@@workspace.routing.org:Organization`
        },
      }, {
        path: 'projects',
        component: ProjectComponent,
        data: {
          breadcrumb: $localize `:@@workspace.routing.projects:Projects`
        },
      }, {
        path: 'profile',
        component: ProfileComponent,
        data: {
          breadcrumb: $localize `:@@workspace.routing.profile:Profile`
        },
      }, {
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
export class WorkspacesRoutingModule { }
