import {Component} from '@angular/core';
import {AuditLogListFilter} from "@core/components/audit-log/types";

@Component({
  selector: 'auditlogs-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent {
  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();
}
