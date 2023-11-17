import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from "@core/guards/auth.guard";

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import("./features/login/login.module").then(m => m.LoginModule)
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () => import("./features/safe/onboarding/onboarding.module").then(m => m.OnboardingModule),
  },
  {
    path: 'select-organization',
    canActivate: [authGuard],
    loadChildren: () => import("./features/safe/select-organization/select-organization.module").then(m => m.SelectOrganizationModule),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import("./features/safe/safe.module").then(m => m.SafeModule),
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
