import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IntegrationsComponent } from './integrations.component';
import { AccessTokensGuard } from "@core/guards/accessTokens.guard";

const routes: Routes = [
  {
    path: '',
    component: IntegrationsComponent,
    children: [
      {
        path: 'access-tokens',
        canActivate: [AccessTokensGuard],
        loadChildren: () => import("./access-tokens/access-tokens.module").then(m => m.AccessTokensModule),
        data: {
          breadcrumb: $localize `:@@integrations.routing.access-tokens:Access tokens`
        },
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class IntegrationsRoutingModule { }
