import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OrganizationsRoutingModule } from './organizations-routing.module';
import { OrganizationsComponent } from './organizations.component';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ProfileComponent } from './profile/profile.component';
import { OrganizationComponent } from './organization/organization.component';
import { ProjectComponent } from './project/project.component';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { ProjectFilterPipe } from "./project/project-filter.pipe";
import { NzSkeletonModule } from "ng-zorro-antd/skeleton";
import { NzTagModule } from "ng-zorro-antd/tag";
import { CoreModule } from "@core/core.module";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";

@NgModule({
  declarations: [
    OrganizationsComponent,
    OrganizationComponent,
    ProfileComponent,
    ProjectComponent,
    ProjectFilterPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    CoreModule,
    NzFormModule,
    NzTabsModule,
    NzIconModule,
    NzInputModule,
    NzButtonModule,
    NzMessageModule,
    NzDividerModule,
    NzTypographyModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzSpinModule,
    NzCardModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSkeletonModule,
    NzTagModule,
    ScrollingModule,
    ReactiveFormsModule,
    OrganizationsRoutingModule,
    CoreModule,
    NzToolTipModule
  ]
})
export class OrganizationsModule { }
