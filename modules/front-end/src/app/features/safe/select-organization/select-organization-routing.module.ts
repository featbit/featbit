import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectOrganizationComponent } from "@features/safe/select-organization/select-organization.component";

const routes: Routes = [
  {
    path: '',
    component: SelectOrganizationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class SelectOrganizationRoutingModule { }
