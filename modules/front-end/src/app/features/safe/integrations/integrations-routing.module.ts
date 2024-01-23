import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { accessTokensGuard } from "@core/guards/accessTokens.guard";

const routes: Routes = [
  { path: '', redirectTo: '/integrations/webhooks', pathMatch: 'full' },
  {
    path: 'webhooks',
    loadChildren: () => import('./webhooks/webhooks.module').then(m => m.WebhooksModule),
    data: {
      breadcrumb: $localize`:@@integrations.routing.webhooks:Webhooks`
    }
  },
  {
    path: 'access-tokens',
    canActivate: [accessTokensGuard],
    loadChildren: () => import("./access-tokens/access-tokens.module").then(m => m.AccessTokensModule),
    data: {
      breadcrumb: $localize`:@@integrations.routing.access-tokens:Access Tokens`
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IntegrationsRoutingModule { }
