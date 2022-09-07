import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {PolicyEditorComponent} from "@features/safe/iam/components/policy-editor/policy-editor.component";
import {NzCheckboxModule} from "ng-zorro-antd/checkbox";
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzModalModule  } from 'ng-zorro-antd/modal';
import {NzCardModule} from "ng-zorro-antd/card";
import {ActionsSelectorComponent} from "@features/safe/iam/components/policy-editor/actions-selector/actions-selector.component";
import {
  ResourcesSelectorComponent
} from "@features/safe/iam/components/policy-editor/resources-selector/resources-selector.component";
import {NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {SharedModule} from "@shared/shared.module";

@NgModule({
  declarations: [
    PolicyEditorComponent,
    ActionsSelectorComponent,
    ResourcesSelectorComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzDropDownModule,
    NzSpinModule,
    NzToolTipModule,
    NzCheckboxModule,
    NzRadioModule,
    NzModalModule,
    NzCardModule,
    NzPopconfirmModule,
    SharedModule
  ],
  exports: [
    PolicyEditorComponent,
    ActionsSelectorComponent,
    ResourcesSelectorComponent,
    CommonModule,
  ]
})
export class ComponentsModule { }
