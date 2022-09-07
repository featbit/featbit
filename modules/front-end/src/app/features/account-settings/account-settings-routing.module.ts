import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AccountSettingsComponent } from './account-settings.component';
import { AccountComponent } from './account/account.component';
import { ProfileComponent } from './profile/profile.component';
import { ProjectComponent } from './project/project.component';
import { TeamComponent } from './team/team.component';

const routes: Routes = [
  {
    path: '',
    component: AccountSettingsComponent,
    children: [
      {
        path: 'org',
        component: AccountComponent
      }, {
        path: 'team',
        component: TeamComponent,
      }, {
        path: 'projects',
        component: ProjectComponent,
      }, {
        path: 'profile',
        component: ProfileComponent,
      }, {
        path: '',
        redirectTo: './org'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountSettingsRoutingModule { }
