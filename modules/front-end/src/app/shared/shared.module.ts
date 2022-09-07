import {NgModule} from "@angular/core";
import {NzSelectModule} from "ng-zorro-antd/select";
import {LocaleSwitcherComponent} from "@shared/locale-switcher/locale-switcher.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {MemberDrawerComponent} from "@shared/member-drawer/member-drawer.component";
import {NzDrawerModule} from "ng-zorro-antd/drawer";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzRadioModule} from "ng-zorro-antd/radio";
import {NzButtonModule} from "ng-zorro-antd/button";
import {MessageComponent} from "@shared/message/message.component";
import {GroupDrawerComponent} from "@shared/group-drawer/group-drawer.component";
import {PolicyDrawerComponent} from "@shared/policy-drawer/policy-drawer.component";
import {AccountDrawerComponent} from "@shared/account-drawer/account-drawer.component";
import {EnvDrawerComponent} from "@shared/env-drawer/env-drawer.component";
import {PermissionCheckComponent} from "@shared/permission-check/permission-check.component";
import {ProjectDrawerComponent} from "@shared/project-drawer/project-drawer.component";
import {MenuComponent} from "@shared/menu/menu.component";
import {NzDropDownModule} from "ng-zorro-antd/dropdown";
import {NzOutletModule} from "ng-zorro-antd/core/outlet";
import {RouterModule} from "@angular/router";
import {OverlayModule} from "@angular/cdk/overlay";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzMenuModule} from "ng-zorro-antd/menu";
import {NzModalModule} from "ng-zorro-antd/modal";
import {NzInputModule} from "ng-zorro-antd/input";
import {NzMessageModule} from "ng-zorro-antd/message";
import {NzOverlayModule} from "ng-zorro-antd/core/overlay";
import {NzTableModule} from "ng-zorro-antd/table";
import {NzDividerModule} from "ng-zorro-antd/divider";
import {NzSpaceModule} from "ng-zorro-antd/space";
import {NzUploadModule} from "ng-zorro-antd/upload";
import {NzSpinModule} from "ng-zorro-antd/spin";
import {NzListModule} from "ng-zorro-antd/list";
import {NzToolTipModule} from "ng-zorro-antd/tooltip";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzResultModule} from "ng-zorro-antd/result";
import {NzLayoutModule} from "ng-zorro-antd/layout";
import {NzCodeEditorModule} from "ng-zorro-antd/code-editor";
import {NzTagModule} from "ng-zorro-antd/tag";
import {NzTabsModule} from "ng-zorro-antd/tabs";
import {NzAlertModule} from "ng-zorro-antd/alert";
import {NzStepsModule} from "ng-zorro-antd/steps";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzImageModule} from "ng-zorro-antd/image";
import {HeaderComponent} from "@shared/header/header.component";

@NgModule({
  declarations: [
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    AccountDrawerComponent,
    EnvDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    MenuComponent,
    HeaderComponent
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
  exports:[
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    AccountDrawerComponent,
    EnvDrawerComponent,
    PermissionCheckComponent,
    ProjectDrawerComponent,
    MenuComponent,
    HeaderComponent
  ]
})
export class SharedModule { }
