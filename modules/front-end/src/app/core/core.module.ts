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
import {PermissionCheckDirective} from "@core/directives/permission-check.directive";
import {LocaleSwitcherComponent} from "@core/components/locale-switcher/locale-switcher.component";
import {MemberDrawerComponent} from "@core/components/member-drawer/member-drawer.component";
import {MessageComponent} from "@core/components/message/message.component";
import {GroupDrawerComponent} from "@core/components/group-drawer/group-drawer.component";
import {PolicyDrawerComponent} from "@core/components/policy-drawer/policy-drawer.component";
import {OrganizationDrawerComponent} from "@core/components/organization-drawer/organization-drawer.component";
import {EnvDrawerComponent} from "@core/components/env-drawer/env-drawer.component";
import {PermissionCheckComponent} from "@core/components/permission-check/permission-check.component";
import {ProjectDrawerComponent} from "@core/components/project-drawer/project-drawer.component";
import {MenuComponent} from "@core/components/menu/menu.component";
import {HeaderComponent} from "@core/components/header/header.component";
import {PropsDrawerComponent} from "@core/components/props-drawer/props-drawer.component";
import {UploadDrawerComponent} from "@core/components/upload-drawer/upload-drawer.component";
import {MetricDrawerComponent} from "@core/components/metric-drawer/metric-drawer.component";
import {ExperimentDrawerComponent} from "@core/components/experiment-drawer/experiment-drawer.component";
import {G2LineChartComponent} from "@core/components/g2-chart/g2-line-chart/g2-line-chart.component";
import {ExptRulesDrawerComponent} from "@core/components/expt-rules-drawer/expt-rules-drawer.component";
import {
  UserSegmentsFlagsDrawerComponent
} from "@core/components/user-segments-flags-drawer/user-segments-flags-drawer.component";
import {TargetUserComponent} from "@core/components/target-user/target-user.component";
import {FindRuleComponent} from "@core/components/find-rule/find-rule.component";
import {ServeMultistatesComponent} from "@core/components/find-rule/serve-multistates/serve-multistates.component";
import {RuleComponent} from "@core/components/find-rule/rule/rule.component";
import {NzCardModule} from "ng-zorro-antd/card";
import {TargetedUserTableComponent} from "@core/components/find-rule/targeted-user-table/targeted-user-table.component";
import {TranslationPipe} from "@core/pipes/translation.pipe";
import {GuideComponent} from "@core/components/guide/guide.component";
import {NzTypographyModule} from "ng-zorro-antd/typography";
import {FindRuleV1Component} from "@core/components/find-rule-v1/find-rule-v1.component";
import {
  TargetedUserTableV1Component
} from "@core/components/find-rule-v1/targeted-user-table-v1/targeted-user-table-v1.component";
import {RuleV1Component} from "@core/components/find-rule-v1/rule-v1/rule-v1.component";
import {
  ServeMultistatesV1Component
} from "@core/components/find-rule-v1/serve-multistates-v1/serve-multistates-v1.component";

@NgModule({
  declarations: [
    SwitchKeyNamePipe,
    PercentagePipe,
    FfcDatePipe,
    PolicyTypePipe,
    TranslationPipe,
    PermissionCheckDirective,

    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    OrganizationDrawerComponent,
    EnvDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    MenuComponent,
    HeaderComponent,
    PropsDrawerComponent,
    UploadDrawerComponent,
    MetricDrawerComponent,
    ExperimentDrawerComponent,
    G2LineChartComponent,
    ExptRulesDrawerComponent,
    UserSegmentsFlagsDrawerComponent,
    TargetUserComponent,
    FindRuleComponent,
    FindRuleV1Component,
    ServeMultistatesComponent,
    ServeMultistatesV1Component,
    RuleComponent,
    RuleV1Component,
    TargetedUserTableComponent,
    TargetedUserTableV1Component,
    GuideComponent
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
    NzCodeEditorModule,
    NzCardModule,
    NzTypographyModule
  ],
  exports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SwitchKeyNamePipe,
    PercentagePipe,
    FfcDatePipe,
    PolicyTypePipe,
    TranslationPipe,
    PermissionCheckDirective,

    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    OrganizationDrawerComponent,
    EnvDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    MenuComponent,
    HeaderComponent,
    PropsDrawerComponent,
    UploadDrawerComponent,
    MetricDrawerComponent,
    ExperimentDrawerComponent,
    G2LineChartComponent,
    ExptRulesDrawerComponent,
    UserSegmentsFlagsDrawerComponent,
    TargetUserComponent,
    FindRuleComponent,
    FindRuleV1Component,
    ServeMultistatesComponent,
    ServeMultistatesV1Component,
    RuleComponent,
    RuleV1Component,
    TargetedUserTableComponent,
    TargetedUserTableV1Component,
    GuideComponent
  ]
})
export class CoreModule { }
