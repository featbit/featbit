import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule } from "@core/core.module";
import { SelectWorkspaceRoutingModule } from "@features/safe/select-workspace/select-workspace-routing.module";
import { SelectWorkspaceComponent } from "@features/safe/select-workspace/select-workspace.component";
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from "ng-zorro-antd/list";
import { NzSpinModule } from 'ng-zorro-antd/spin';

@NgModule({
  declarations: [
    SelectWorkspaceComponent
  ],
  imports: [
    NzTypographyModule,
    NzIconModule,
    CoreModule,
    CommonModule,
    SelectWorkspaceRoutingModule,
    NzListModule,
    NzSpinModule
  ],
  providers: [
  ]
})
export class SelectWorkspaceModule { }
