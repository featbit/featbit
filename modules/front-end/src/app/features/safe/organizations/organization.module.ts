import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzAlertComponent } from 'ng-zorro-antd/alert';

import { CoreModule } from '@core/core.module';
import { OrganizationRoutingModule } from './organization-routing.module';
import { OrganizationComponent } from '@features/safe/organizations/organization/organization.component';
import { ProjectComponent } from '@features/safe/organizations/project/project.component';
import { ProjectFilterPipe } from '@features/safe/organizations/project/project-filter.pipe';
import { ProfileComponent } from '@features/safe/organizations/profile/profile.component';
import { OrganizationsComponent } from "@features/safe/organizations/organizations.component";

@NgModule({
  declarations: [
    OrganizationsComponent,
    OrganizationComponent,
    ProjectComponent,
    ProjectFilterPipe,
    ProfileComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CoreModule,
    NzFormModule,
    NzTabsModule,
    NzIconModule,
    NzInputModule,
    NzButtonModule,
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
    NzToolTipModule,
    NzAlertComponent,
    ScrollingModule,
    OrganizationRoutingModule
  ]
})
export class OrganizationModule { }
