import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule } from "@core/core.module";
import { SelectOrganizationRoutingModule } from "@features/safe/select-organization/select-organization-routing.module";
import { SelectOrganizationComponent } from "@features/safe/select-organization/select-organization.component";
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from "ng-zorro-antd/list";

@NgModule({
  declarations: [
    SelectOrganizationComponent
  ],
  imports: [
    NzTypographyModule,
    NzIconModule,
    CoreModule,
    CommonModule,
    SelectOrganizationRoutingModule,
    NzListModule,
  ],
  providers: [
  ]
})
export class SelectOrganizationModule { }
