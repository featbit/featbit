import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {AuditLogListFilter, RefTypeEnum} from "@core/components/audit-log/types";

@Component({
  selector: 'segment-auditlogs',
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.less']
})
export class AuditLogsComponent implements OnInit {
  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  constructor(
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      const id = decodeURIComponent(paramMap.get('id'));
      this.auditLogFilter.refType = RefTypeEnum.Segment;
      this.auditLogFilter.refId = id;
    })
  }
}
