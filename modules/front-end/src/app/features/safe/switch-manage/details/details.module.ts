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
import { SharedModule } from '@shared/shared.module';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzModalModule  } from 'ng-zorro-antd/modal';

import { ComponentsModule as LocalComponentsModule } from '../components/components.module';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzResultModule } from 'ng-zorro-antd/result';
import { SafeHtmlPipe } from '@core/pipes/safe-html.pipe';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { TargetingComponent } from './targeting/targeting.component';
import { SettingComponent } from './setting/setting.component';
import { TriggersComponent } from './triggers/triggers.component';
import { ReportingComponent } from './reporting/reporting.component';
import { ExperimentationComponent } from './experimentation/experimentation.component';
import { NzCodeEditorModule } from 'ng-zorro-antd/code-editor';
import {NzGridModule} from "ng-zorro-antd/grid";

@NgModule({
  declarations: [
    DetailsComponent,
    SettingComponent,
    TargetingComponent,
    TriggersComponent,
    ReportingComponent,
    ExperimentationComponent,
    SafeHtmlPipe
  ],
  imports: [
    LocalComponentsModule,
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
    SharedModule,
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
    NzCodeEditorModule,
    DetailsRoutingModule,
    NzGridModule
  ],
  providers: [
  ]
})
export class DetailsModule { }
