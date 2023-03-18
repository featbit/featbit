import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AccessTokensComponent } from "@features/safe/integrations/access-tokens/access-tokens.component";

const routes: Routes = [
  {
    path: '',
    component: AccessTokensComponent,
    children: [
      {
        path: '',
        loadChildren: () => import("./index/index.module").then(m => m.IndexModule),
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class AccessTokensRoutingModule { }
