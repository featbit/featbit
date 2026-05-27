import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectWorkspaceOrganizationComponent } from "@features/safe/select-workspace-organization/select-workspace-organization.component";

const routes: Routes = [
  {
    path: '',
    component: SelectWorkspaceOrganizationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class SelectWorkspaceOrganizationRoutingModule { }
