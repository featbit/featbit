import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from "@core/guards/auth.guard";

const routes: Routes = [
  {
    path: 'login',
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
