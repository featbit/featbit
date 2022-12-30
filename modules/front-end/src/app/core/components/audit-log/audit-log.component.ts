import {Component, Input} from "@angular/core";
import {SegmentService} from "@services/segment.service";
import {EnvUserService} from "@services/env-user.service";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {encodeURIComponentFfc, isSegmentCondition} from "@utils/index";
import {ICondition} from "@shared/rules";
import {lastValueFrom} from "rxjs";
import {Router} from "@angular/router";
import {AuditLogOpEnum, IAuditLog, RefTypeEnum} from "@core/components/audit-log/types";
import {DiffFactoryService} from "@services/diff-factory.service";
import {ICategory, OperationEnum} from "@shared/diff/types";
import {ISegment} from "@features/safe/segments/types/segments-index";
import {IUserType} from "@shared/types";

@Component({
  selector: 'audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.less']
})
export class AuditLogComponent {
  private previous: IFeatureFlag | ISegment | string;
  private current: IFeatureFlag | ISegment | string;

  auditLog: IAuditLog;
  changeCategories: ICategory[] = [];
  constructor(
    private router: Router,
    private diffFactoryService: DiffFactoryService,
    private segmentService: SegmentService,
    private envUserService: EnvUserService
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

    if (this.shouldShowChangeList) {
      this.calculateHtmlDiff();
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

  async calculateHtmlDiff() {
    let previous: IFeatureFlag | ISegment;
    let current: IFeatureFlag | ISegment;
    let targetUserIdRefs: string[];

    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        previous = this.previous as IFeatureFlag;
        current = this.current as IFeatureFlag;

        // get all end users
        const previousTargetUserIdRefs: string[] = previous?.targetUsers?.flatMap((v) => v.keyIds) ?? [];
        const currentTargetUserIdRefs: string[] = current?.targetUsers?.flatMap((v) => v.keyIds) ?? [];
        targetUserIdRefs = [...previousTargetUserIdRefs, ...currentTargetUserIdRefs];
        targetUserIdRefs = targetUserIdRefs.filter((id, idx) => targetUserIdRefs.indexOf(id) === idx);

        // get all segmentIds from originalData and new Data
        const previousSegmentIdRefs: string[] = previous?.rules?.flatMap((rule) => rule.conditions)
          .filter((condition) => isSegmentCondition(condition) && condition.value.length > 0)
          .flatMap((condition: ICondition) => JSON.parse(condition.value))
          .filter((id) => id !== null && id.length > 0) ?? [];

        const currentSegmentIdRefs: string[] = current?.rules?.flatMap((rule) => rule.conditions)
          .filter((condition) => isSegmentCondition(condition) && condition.value.length > 0)
          .flatMap((condition: ICondition) => JSON.parse(condition.value))
          .filter((id) => id !== null && id.length > 0) ?? [];

        let segmentIdRefs: string[] = [...previousSegmentIdRefs, ...currentSegmentIdRefs];
        segmentIdRefs = segmentIdRefs.filter((id, idx) => segmentIdRefs.indexOf(id) === idx); // get unique values

        const promises = [];

        if (targetUserIdRefs.length) {
          promises.push(this.getUserRefs(targetUserIdRefs));
        }

        if (segmentIdRefs.length) {
          promises.push(this.getSegmentRefs(segmentIdRefs));
        }

        await Promise.all(promises);
        break;
      case RefTypeEnum.Segment:
        const previousSegment = this.previous as ISegment;
        const currentSegment = this.current as ISegment;

        // get all end users
        const previousIncludeRefs: string[] = previousSegment?.included ?? [];
        const currentIncludeRefs: string[] = currentSegment?.included ?? [];
        const previousExcludeRefs: string[] = previousSegment?.excluded ?? [];
        const currentExcludeRefs: string[] = currentSegment?.excluded ?? [];

        targetUserIdRefs = [...previousIncludeRefs, ...currentIncludeRefs, ...previousExcludeRefs, ...currentExcludeRefs];
        targetUserIdRefs = targetUserIdRefs.filter((id, idx) => targetUserIdRefs.indexOf(id) === idx);

        await Promise.all([this.getUserRefs(targetUserIdRefs)]);
        break;
      default:
        break;
    }

    this.changeCategories = this.diffFactoryService.getDiffer(this.auditLog.refType as RefTypeEnum).diff(this.auditLog.dataChange.previous, this.auditLog.dataChange.current, {targetingUsers: this.userRefs, segments: this.segmentRefs});
  }

  userRefs: IUserType[] = [];
  segmentRefs: ISegment[] = [];
  private async getUserRefs(keyIds: string[]) {
    const missingIds = keyIds.filter((keyId) => !this.userRefs.find((user) => user.keyId === keyId));
    const users = missingIds.length === 0 ? [] : await lastValueFrom(this.envUserService.getByKeyIds(missingIds));

    this.userRefs = [
      ...this.userRefs,
      ...users
    ];
  }

  private async getSegmentRefs(segmentIds: string[]) {
    const missingKeyIds = segmentIds.filter((id) => !this.segmentRefs.find((segment) => segment.id === id));
    const segments = missingKeyIds.length === 0 ? [] : await lastValueFrom(this.segmentService.getByIds(missingKeyIds));

    this.segmentRefs = [
      ...this.segmentRefs,
      ...segments
    ];
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
