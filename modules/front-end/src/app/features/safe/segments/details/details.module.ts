import { NgModule } from '@angular/core';
import { DetailsRoutingModule } from './details-routing.module';
import { CommonModule } from '@angular/common';
import { DetailsComponent } from './details.component';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TargetingComponent } from './targeting/targeting.component';
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
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzModalModule  } from 'ng-zorro-antd/modal';
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SettingComponent } from './setting/setting.component';
import {CoreModule} from "@core/core.module";
import {AuditLogsComponent} from "@features/safe/segments/details/audit-logs/audit-logs.component";
import {NzFormModule} from "ng-zorro-antd/form";

@NgModule({
  declarations: [
    DetailsComponent,
    SettingComponent,
    TargetingComponent,
    AuditLogsComponent
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
    CommonModule,
    NzTypographyModule,
    NzDividerModule,
    NzModalModule,
    DetailsRoutingModule,
    NzCollapseModule,
    NzDropDownModule,
    NzSkeletonModule,
    DragDropModule,
    NzToolTipModule,
    NzDescriptionsModule,
    CoreModule,
    NzFormModule
  ],
  providers: [
  ]
})
export class DetailsModule { }
