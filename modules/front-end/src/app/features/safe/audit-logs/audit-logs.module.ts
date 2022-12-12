import { NgModule } from '@angular/core';
import { AuditLogsRoutingModule } from './audit-logs-routing.module';
import { CommonModule } from '@angular/common';
import { AuditLogsComponent } from './audit-logs.component';


@NgModule({
  declarations: [
    AuditLogsComponent,
  ],
  imports: [
    CommonModule,
    AuditLogsRoutingModule
  ],
  providers: []
})
export class AuditLogsModule { }
