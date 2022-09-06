import {NgModule} from "@angular/core";
import {NzSelectModule} from "ng-zorro-antd/select";
import {LocaleSwitcherComponent} from "@shared/locale-switcher/locale-switcher.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";

@NgModule({
  declarations: [
    LocaleSwitcherComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NzSelectModule
  ],
  exports:[
    LocaleSwitcherComponent
  ]
})
export class SharedModule { }
