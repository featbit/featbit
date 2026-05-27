import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule } from "@core/core.module";
import { SelectWorkspaceOrganizationRoutingModule } from "@features/safe/select-workspace-organization/select-workspace-organization-routing.module";
import { SelectWorkspaceOrganizationComponent } from "@features/safe/select-workspace-organization/select-workspace-organization.component";
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from "ng-zorro-antd/list";
import { NzSpinModule } from 'ng-zorro-antd/spin';

@NgModule({
  declarations: [
    SelectWorkspaceOrganizationComponent
  ],
  imports: [
    NzTypographyModule,
    NzIconModule,
    CoreModule,
    CommonModule,
    SelectWorkspaceOrganizationRoutingModule,
    NzListModule,
    NzSpinModule
  ],
  providers: [
  ]
})
export class SelectWorkspaceOrganizationModule { }
