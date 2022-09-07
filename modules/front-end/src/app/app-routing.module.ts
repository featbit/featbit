import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LoginGuard } from "@core/guards/login.guard";
import {IAMGuard} from "@core/guards/iam.guard";

const routes: Routes = [
  {
    path: 'login',
    canActivate: [LoginGuard],
    loadChildren: () => import("./features/login/login.module").then(m => m.LoginModule)
  },
  {
    path: 'account-settings',
    loadChildren: () => import("./features/account-settings/account-settings.module").then(m => m.AccountSettingsModule),
    data: {
      breadcrumb: '组织机构'
    },
  },
  {
    path: 'iam',
    canActivate: [IAMGuard],
    loadChildren: () => import("./features/iam/iam.module").then(m => m.IAMModule),
    data: {
      breadcrumb: '角色&权限'
    },
  },
  {
    path: '',
    redirectTo: '/account-settings',
    pathMatch: 'full'
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
