import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LoginGuard } from "@core/guards/login.guard";
import {AccountProjectEnvResolver} from "@services/account-preject-env-resolver.service";
import {AuthGuard} from "@core/guards/auth.guard";

const routes: Routes = [
  {
    path: 'login',
    canActivate: [LoginGuard],
    loadChildren: () => import("./features/login/login.module").then(m => m.LoginModule)
  },
  {
    path: 'onboarding',
    canActivate: [AuthGuard],
    loadChildren: () => import("./features/safe/onboarding/onboarding.module").then(m => m.OnboardingModule),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () => import("./features/safe/safe.module").then(m => m.SafeModule),
    resolve: {
      _: AccountProjectEnvResolver // Ensure that the current account and project env are loaded before activate the safe module
    },
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
