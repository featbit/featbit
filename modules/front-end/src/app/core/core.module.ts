import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { RouterModule } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';

import { NzFormModule } from 'ng-zorro-antd/form';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzOverlayModule } from 'ng-zorro-antd/core/overlay';
import { NzOutletModule } from 'ng-zorro-antd/core/outlet';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { SwitchKeyNamePipe } from './pipes/switch-key-name.pipe';
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzStepsModule } from "ng-zorro-antd/steps";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzResultModule } from "ng-zorro-antd/result";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzImageModule } from "ng-zorro-antd/image";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzCodeEditorModule} from "ng-zorro-antd/code-editor";
import {PercentagePipe} from "@core/pipes/percentage.pipe";
import {FfcDatePipe} from "@core/pipes/ffcdate.pipe";
import {PolicyTypePipe} from "@core/pipes/policy-type.pipe";
import {ExtraUserColumnPipe} from "@core/pipes/extra-user-column.pipe";
import {SubscriptionTypePipe} from "@core/pipes/subscription-type.pipe";

@NgModule({
  declarations: [
    SwitchKeyNamePipe,
    PercentagePipe,
    FfcDatePipe,
    PolicyTypePipe,
    ExtraUserColumnPipe,
    SubscriptionTypePipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    OverlayModule,
    ReactiveFormsModule,
    RouterModule,
    NzFormModule,
    NzIconModule,
    NzMenuModule,
    NzModalModule,
    NzInputModule,
    NzOutletModule,
    NzButtonModule,
    NzDrawerModule,
    NzMessageModule,
    NzOverlayModule,
    NzDropDownModule,
    NzTableModule,
    NzSelectModule,
    NzDividerModule,
    NzSpaceModule,
    NzSpinModule,
    NzRadioModule,
    NzUploadModule,
    NzTagModule,
    NzToolTipModule,
    NzListModule,
    NzCheckboxModule,
    NzTabsModule,
    NzPopconfirmModule,
    NzStepsModule,
    NzAlertModule,
    NzResultModule,
    NzLayoutModule,
    NzImageModule,
    NzPopoverModule,
    NzCodeEditorModule
  ],
  exports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SwitchKeyNamePipe,
    PercentagePipe,
    FfcDatePipe,
    PolicyTypePipe,
    ExtraUserColumnPipe,
    SubscriptionTypePipe
  ]
})
export class CoreModule { }
