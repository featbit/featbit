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
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzStepsModule } from "ng-zorro-antd/steps";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzResultModule } from "ng-zorro-antd/result";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzImageModule } from "ng-zorro-antd/image";
import { NzPopoverModule } from "ng-zorro-antd/popover";
import { NzCodeEditorModule } from "ng-zorro-antd/code-editor";
import { PercentagePipe } from "@core/pipes/percentage.pipe";
import { PolicyTypePipe } from "@core/pipes/policy-type.pipe";
import { PermissionCheckDirective } from "@core/directives/permission-check.directive";
import { LocaleSwitcherComponent } from "@core/components/locale-switcher/locale-switcher.component";
import { MemberDrawerComponent } from "@core/components/member-drawer/member-drawer.component";
import { MessageComponent } from "@core/components/message/message.component";
import { GroupDrawerComponent } from "@core/components/group-drawer/group-drawer.component";
import { PolicyDrawerComponent } from "@core/components/policy-drawer/policy-drawer.component";
import { OrganizationDrawerComponent } from "@core/components/organization-drawer/organization-drawer.component";
import { EnvDrawerComponent } from "@core/components/env-drawer/env-drawer.component";
import { PermissionCheckComponent } from "@core/components/permission-check/permission-check.component";
import { ProjectDrawerComponent } from "@core/components/project-drawer/project-drawer.component";
import { MenuComponent } from "@core/components/menu/menu.component";
import { HeaderComponent } from "@core/components/header/header.component";
import { PropsDrawerComponent } from "@core/components/props-drawer/props-drawer.component";
import { UploadDrawerComponent } from "@core/components/upload-drawer/upload-drawer.component";
import { MetricDrawerComponent } from "@core/components/metric-drawer/metric-drawer.component";
import { ExperimentDrawerComponent } from "@core/components/experiment-drawer/experiment-drawer.component";
import { G2LineChartComponent } from "@core/components/g2-chart/g2-line-chart/g2-line-chart.component";
import { ExptRulesDrawerComponent } from "@core/components/expt-rules-drawer/expt-rules-drawer.component";
import {
  UserSegmentsFlagsDrawerComponent
} from "@core/components/user-segments-flags-drawer/user-segments-flags-drawer.component";
import { TargetUserComponent } from "@core/components/target-user/target-user.component";
import { FindRuleComponent } from "@core/components/find-rule/find-rule.component";
import { ServeComponent } from "@core/components/find-rule/serve/serve.component";
import { RuleComponent } from "@core/components/find-rule/rule/rule.component";
import { NzCardModule } from "ng-zorro-antd/card";
import { TranslationPipe } from "@core/pipes/translation.pipe";
import { NzTypographyModule } from "ng-zorro-antd/typography";
import { RuleVariationValuePipe } from "@core/components/find-rule/serve/rule-variation-value.pipe";
import { SlugifyPipe } from "@core/pipes/slugify";
import { AuditLogComponent } from "@core/components/audit-log/audit-log.component";
import { AuditLogsComponent } from "@core/components/audit-logs/audit-logs.component";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzTimelineModule } from "ng-zorro-antd/timeline";
import { ChangeReviewComponent } from "@core/components/change-review/change-review.component";
import { NzBreadCrumbModule } from "ng-zorro-antd/breadcrumb";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { AccessTokenDrawerComponent } from "@core/components/access-token-drawer/access-token-drawer.component";
import { AccessTokenTypePipe } from "@core/pipes/access-token-type.pipe";
import { AccessTokenStatusPipe } from "@core/pipes/access-token-status.pipe";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { GuideComponent } from "@core/components/guide/guide.component";
import { PrismComponent } from './components/prism/prism.component';
import { FeatureFlagDrawerComponent } from "@core/components/feature-flag-drawer/feature-flag-drawer.component";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import {
  PendingChangesDrawerComponent
} from "@core/components/pending-changes-drawer/pending-changes-drawer.component";
import { ChangeListModule } from "@core/components/change-list/change-list.module";
import { PipesModule } from "@core/pipes/pipes.module";
import { LicenseComponent } from "@core/components/license/license.component";
import { WebhookDrawerComponent } from './components/webhook-drawer/webhook-drawer.component';
import { HandlebarsService } from "@services/handlebars.service";
import { TestWebhookModalComponent } from './components/test-webhook-modal/test-webhook-modal.component';
import { WebhookDeliveryComponent } from './components/webhook-delivery/webhook-delivery.component';
import { NzSkeletonModule } from "ng-zorro-antd/skeleton";
import { WebhookDeliveriesComponent } from './components/webhook-deliveries/webhook-deliveries.component';
import { NzSegmentedModule } from "ng-zorro-antd/segmented";
import { ResourceFinderComponent } from './components/resource-finder/resource-finder.component';
import { ImportUserComponent } from './components/import-user/import-user.component';
import { EndUserDrawerComponent } from './components/end-user-drawer/end-user-drawer.component';
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { SegmentCreationModalComponent } from './components/segment-creation-modal/segment-creation-modal.component';
import { CopyFeatureFlagModalComponent } from '@core/components/copy-feature-flag-modal/copy-feature-flag-modal.component';
import { BroadcastService } from "@services/broadcast.service";
import { RelayProxyDrawerComponent } from '@core/components/relay-proxy-drawer/relay-proxy-drawer.component';
import { RelayProxyAgentModalComponent } from './components/relay-proxy-agent-modal/relay-proxy-agent-modal.component';
import { RelayProxyKeyModalComponent } from './components/relay-proxy-key-modal/relay-proxy-key-modal.component';

@NgModule({
  declarations: [
    PermissionCheckDirective,
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    OrganizationDrawerComponent,
    EnvDrawerComponent,
    PendingChangesDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    MenuComponent,
    HeaderComponent,
    PropsDrawerComponent,
    UploadDrawerComponent,
    MetricDrawerComponent,
    ExperimentDrawerComponent,
    FeatureFlagDrawerComponent,
    G2LineChartComponent,
    ExptRulesDrawerComponent,
    UserSegmentsFlagsDrawerComponent,
    TargetUserComponent,
    FindRuleComponent,
    ServeComponent,
    RuleComponent,
    GuideComponent,
    AuditLogsComponent,
    AuditLogComponent,
    ChangeReviewComponent,
    AccessTokenDrawerComponent,
    RelayProxyDrawerComponent,
    PrismComponent,
    LicenseComponent,
    WebhookDrawerComponent,
    TestWebhookModalComponent,
    WebhookDeliveryComponent,
    WebhookDeliveriesComponent,
    ResourceFinderComponent,
    ImportUserComponent,
    EndUserDrawerComponent,
    SegmentCreationModalComponent,
    CopyFeatureFlagModalComponent,
    RelayProxyDrawerComponent,
    RelayProxyAgentModalComponent,
    RelayProxyKeyModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    OverlayModule,
    ReactiveFormsModule,
    RouterModule,
    PipesModule,
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
    NzTypographyModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzTimelineModule,
    NzBreadCrumbModule,
    NzInputNumberModule,
    NzCollapseModule,
    NzSwitchModule,
    ChangeListModule,
    NzSkeletonModule,
    NzSegmentedModule,
    NzDescriptionsModule
  ],
  exports: [
    SlugifyPipe,
    PercentagePipe,
    PolicyTypePipe,
    AccessTokenTypePipe,
    AccessTokenStatusPipe,
    TranslationPipe,
    RuleVariationValuePipe,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PermissionCheckDirective,
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    OrganizationDrawerComponent,
    EnvDrawerComponent,
    PendingChangesDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    FeatureFlagDrawerComponent,
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
    ServeComponent,
    RuleComponent,
    GuideComponent,
    AuditLogsComponent,
    AuditLogComponent,
    ChangeReviewComponent,
    AccessTokenDrawerComponent,
    RelayProxyDrawerComponent,
    PrismComponent,
    LicenseComponent,
    WebhookDrawerComponent,
    TestWebhookModalComponent,
    WebhookDeliveryComponent,
    WebhookDeliveriesComponent,
    ResourceFinderComponent,
    ImportUserComponent,
    EndUserDrawerComponent,
    SegmentCreationModalComponent,
    CopyFeatureFlagModalComponent,
    RelayProxyDrawerComponent,
    RelayProxyAgentModalComponent,
    RelayProxyKeyModalComponent
  ]
})
export class CoreModule {
  constructor(handlebars: HandlebarsService, broadcastService: BroadcastService) {
    handlebars.init();
    broadcastService.init();
  }
}
