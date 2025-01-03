import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuditLogListFilter, RefTypeEnum } from "@core/components/audit-log/types";
import { SegmentService } from "@services/segment.service";
import { SegmentType } from "@features/safe/segments/types/segments-index";

@Component({
  selector: 'segment-auditlogs',
  templateUrl: './audit-logs.component.html',
  styleUrls: [ './audit-logs.component.less' ]
})
export class AuditLogsComponent implements OnInit {
  isLoading: boolean = true;
  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  constructor(
    private route: ActivatedRoute,
    private segmentService: SegmentService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      const id = decodeURIComponent(paramMap.get('id'));
      this.auditLogFilter.refType = RefTypeEnum.Segment;
      this.auditLogFilter.refId = id;

      this.segmentService.getSegment(id).subscribe({
        next: (segment) => {
          this.auditLogFilter.crossEnvironment = segment.type === SegmentType.Shared;
          this.isLoading = false;
        }
      })
    })
  }
}
