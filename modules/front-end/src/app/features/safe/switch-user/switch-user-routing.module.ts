import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserDetailComponent } from './user-detail/user-detail.component';
import { SwitchUserResolver } from './user-detail/user-detail.resolver';
import { UserListComponent } from './user-list/user-list.component';

const routes: Routes = [
  {
    path: '',
    component: UserListComponent
  }, {
    path: ':id',
    component: UserDetailComponent,
    resolve: { envUser: SwitchUserResolver },
    data: {
      breadcrumb: (data: any) => `${data.envUser?.name || "用户详情"}`, // dynamic
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SwitchUserRoutingModule { }
