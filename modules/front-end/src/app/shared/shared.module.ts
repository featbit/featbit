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

@NgModule({
  declarations: [
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    AccountDrawerComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NzFormModule,
    NzSelectModule,
    NzDrawerModule,
    NzRadioModule,
    NzButtonModule
  ],
  exports:[
    LocaleSwitcherComponent,
    MemberDrawerComponent,
    MessageComponent,
    GroupDrawerComponent,
    PolicyDrawerComponent,
    AccountDrawerComponent
  ]
})
export class SharedModule { }
