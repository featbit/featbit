import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subject} from 'rxjs';
import {AuditLogListFilter} from "@core/components/audit-log/types";

@Component({
  selector: 'auditlogs-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnDestroy {
  private destory$: Subject<void> = new Subject();

  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }
}
