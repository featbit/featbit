import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectWorkspaceComponent } from "@features/safe/select-workspace/select-workspace.component";

const routes: Routes = [
  {
    path: '',
    component: SelectWorkspaceComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class SelectWorkspaceRoutingModule { }
