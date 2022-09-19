import { NgModule } from '@angular/core';
import { DetailsRoutingModule } from './details-routing.module';
import { CommonModule } from '@angular/common';
import { DetailsComponent } from './details.component';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { ComponentsModule } from '../../components/components.module';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzModalModule  } from 'ng-zorro-antd/modal';

import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { TeamComponent } from './team/team.component';
import { SettingComponent } from './setting/setting.component';
import {GroupsComponent} from "./groups/groups.component";
import {PermissionComponent} from "@features/safe/iam/policies/details/permission/permission.component";
import {CoreModule} from "@core/core.module";

@NgModule({
    declarations: [
        DetailsComponent,
        SettingComponent,
        TeamComponent,
        GroupsComponent,
        PermissionComponent
    ],
  imports: [
    CommonModule,
    FormsModule,
    NzTabsModule,
    NzCardModule,
    NzSpinModule,
    NzSelectModule,
    NzEmptyModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzTagModule,
    NzSpaceModule,
    NzPopconfirmModule,
    ComponentsModule,
    ComponentsModule,
    NzMessageModule,
    NzTypographyModule,
    NzDividerModule,
    NzModalModule,
    NzDropDownModule,
    NzSwitchModule,
    NzCollapseModule,
    DragDropModule,
    NzRadioModule,
    NzResultModule,
    NzToolTipModule,
    NzSkeletonModule,
    DetailsRoutingModule,
    CoreModule
  ],
    exports: [
        PermissionComponent
    ],
    providers: []
})
export class DetailsModule { }
