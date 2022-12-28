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
import {ICategory} from "@shared/diffv2/types";

@Component({
  selector: 'audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.less']
})
export class AuditLogComponent {
  private previous: IFeatureFlag | string;
  private current: IFeatureFlag | string;

  auditLog: IAuditLog;
  htmlDiff: string = '';
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

  get targetData(): IFeatureFlag | string {
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
    return true;//this.auditLog.operation === AuditLogOpEnum.Update;
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
        result += ` ${$localize `:@@auditlogs.idx.operation-create:created`}`;
        break;
      case AuditLogOpEnum.Update:
        result += ` ${$localize `:@@auditlogs.idx.operation-update:updated`}`;
        break;
      case AuditLogOpEnum.Archive:
        result += ` ${$localize `:@@auditlogs.idx.operation-archive:archived`}`;
        break;
      case AuditLogOpEnum.Restore:
        result += ` ${$localize `:@@auditlogs.idx.operation-restore:restored`}`;
        break;
      case AuditLogOpEnum.Remove:
        result += ` ${$localize `:@@auditlogs.idx.operation-remove:removed`}`;
        break;
      default:
        result += ` ${this.auditLog.operation}`;
    }

    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        result += ` ${$localize `:@@auditlogs.idx.reftype-flag:the flag`}`;
        break;
      default:
        break;
    }

    return result;
  }

  async calculateHtmlDiff() {
    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        const previous = this.previous as IFeatureFlag;
        const current = this.current as IFeatureFlag;
        // get all end users
        const previousTargetUserIdRefs: string[] = previous?.targetUsers?.flatMap((v) => v.keyIds) ?? [];
        const currentTargetUserIdRefs: string[] = current?.targetUsers?.flatMap((v) => v.keyIds) ?? [];
        let targetUserIdRefs: string[] = [...previousTargetUserIdRefs, ...currentTargetUserIdRefs];
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
          promises.push(lastValueFrom(this.envUserService.getByKeyIds(targetUserIdRefs)));
        } else {
          promises.push([]);
        }

        if (segmentIdRefs.length) {
          promises.push(lastValueFrom(this.segmentService.getByIds(segmentIdRefs)));
        } else {
          promises.push([]);
        }

        const refs = await Promise.all(promises);

        this.changeCategories = this.diffFactoryService.getDiffer(this.auditLog.refType).getChangeList(this.auditLog.dataChange.previous, this.auditLog.dataChange.current, {targetingUsers: refs[0], segments: refs[1]});
        return;
      default:
        break;
    }
  }

  goToTargetPage() {
    switch (this.auditLog.refType) {
      case RefTypeEnum.Flag:
        this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc((this.targetData as IFeatureFlag).key)}/targeting`);
        return;
      default:
        this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc((this.targetData as IFeatureFlag).key)}/targeting`);
        return;
    }
  }
}
