import { Component, Input } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { encodeURIComponentFfc } from "@utils/index";
import { Router } from "@angular/router";
import { AuditLogOpEnum, IAuditLog, RefTypeEnum } from "@core/components/audit-log/types";
import { ISegment } from "@features/safe/segments/types/segments-index";

@Component({
  selector: 'audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.less']
})
export class AuditLogComponent {
  private previous: IFeatureFlag | ISegment | string;
  private current: IFeatureFlag | ISegment | string;

  auditLog: IAuditLog;
  constructor(
    private router: Router
  ) {
  }

  @Input("auditLog")
  set list(data: IAuditLog) {
    this.auditLog = {...data};

    if (this.auditLog.dataChange.previous?.length > 0) {
      try {
        this.previous = JSON.parse(this.auditLog.dataChange.previous);
      } catch (e) {
        this.previous = this.auditLog.dataChange.previous;
      }
    }

    if (this.auditLog.dataChange.current?.length > 0) {
      try {
        this.current = JSON.parse(this.auditLog.dataChange.current);
      } catch (e) {
        this.current = this.auditLog.dataChange.current;
      }
    }
  }

  get targetData(): IFeatureFlag | ISegment | string {
    switch (this.auditLog.operation) {
      case AuditLogOpEnum.Create:
        return this.current;
      case AuditLogOpEnum.Remove:
        return this.previous;
      default:
        return this.current;
    }
  }

  get shouldShowChangeList(): boolean {
    return this.auditLog.operation === AuditLogOpEnum.Update;
  }

  get name(): string {
    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        return (this.targetData as IFeatureFlag).name;
      default:
        return (this.targetData as IFeatureFlag).name;
    }
  }

  get titlePrefix(): string {
    let result = this.auditLog.creatorEmail;

    if (this.auditLog.creatorName?.length > 0) {
      result += ` (${this.auditLog.creatorName})`;
    }

    switch (this.auditLog.operation) {
      case AuditLogOpEnum.Create:
        result += ` ${$localize `:@@auditlogs.operation-create:created`}`;
        break;
      case AuditLogOpEnum.Update:
        result += ` ${$localize `:@@auditlogs.operation-update:updated`}`;
        break;
      case AuditLogOpEnum.Archive:
        result += ` ${$localize `:@@auditlogs.operation-archive:archived`}`;
        break;
      case AuditLogOpEnum.Restore:
        result += ` ${$localize `:@@auditlogs.operation-restore:restored`}`;
        break;
      case AuditLogOpEnum.Remove:
        result += ` ${$localize `:@@auditlogs.operation-remove:removed`}`;
        break;
      case AuditLogOpEnum.ApplyFlagChangeRequest:
        result += ` ${$localize `:@@auditlogs.operation-apply-flag-change-request:applied change request to`}`;
        break;
      case AuditLogOpEnum.ApplyFlagSchedule:
        result += ` ${$localize `:@@auditlogs.operation-apply-flag-schedule:applied schedule to`}`;
        break;
      default:
        result += ` ${this.auditLog.operation}`;
    }

    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        result += ` ${$localize `:@@auditlogs.reftype-flag:flag`}`;
        break;
      case RefTypeEnum.Segment:
        result += ` ${$localize `:@@auditlogs.reftype-segment:segment`}`;
        break;
      default:
        break;
    }

    return result;
  }

  goToTargetPage() {
    if (this.auditLog.operation !== AuditLogOpEnum.Remove) {
      switch (this.auditLog.refType) {
        case RefTypeEnum.Flag:
          this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc((this.targetData as IFeatureFlag).key)}/targeting`);
          return;
        case RefTypeEnum.Segment:
          this.router.navigateByUrl(`/segments/details/${encodeURIComponentFfc((this.targetData as ISegment).id)}/targeting`);
          return;
        default:
          this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc((this.targetData as IFeatureFlag).key)}/targeting`);
          return;
      }
    }
  }
}
