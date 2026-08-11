import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {IndexComponent} from "@features/safe/integrations/access-tokens/index/index.component";


const routes: Routes = [
  {
    path: '',
    component: IndexComponent,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class IndexRoutingModule { }
