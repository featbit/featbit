import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {FeatureFlagService} from "@services/feature-flag.service";
import {AuditLogListFilter, RefTypeEnum} from "@core/components/audit-log/types";

@Component({
    selector: 'ff-auditlogs',
    templateUrl: './audit-logs.component.html',
    styleUrls: ['./audit-logs.component.less'],
    standalone: false
})
export class AuditLogsComponent implements OnInit {
  loading: boolean = true;
  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
  ) {
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      const key = decodeURIComponent(paramMap.get('key'));
      this.featureFlagService.getByKey(key).subscribe((result: IFeatureFlag) => {
        this.auditLogFilter.refType = RefTypeEnum.Flag;
        this.auditLogFilter.refId = result.id;
        this.loading = false;
      }, () => this.loading = false);
    })
  }
}
