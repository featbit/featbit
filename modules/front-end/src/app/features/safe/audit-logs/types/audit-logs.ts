import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import featureFlagDiffer from "@utils/diff/feature-flag.differ";
import {encodeURIComponentFfc, isSegmentCondition} from "@utils/index";
import {ICondition} from "@shared/rules";
import {SegmentService} from "@services/segment.service";
import {lastValueFrom} from "rxjs";
import {EnvUserService} from "@services/env-user.service";

export interface IAuditLogListModel {
  items: IAuditLog[];
  totalCount: number;
}

export enum RefTypeEnum {
  Flag = 'FeatureFlag'
}

export enum AuditLogOpEnum {
  Create = 'Create',
  Update = 'Update',
  Archive = 'Archive',
  Restore = 'Restore',
  Remove = 'Remove'
}

export interface IDataChange {
  previous?: string // undefined if operation is Create
  current?: string // undefined if operation is Remove
}

export interface IAuditLog {
  id: string;
  refId: string;
  refType: string;
  operation: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: string;
  comment: string;
  dataChange: IDataChange;
}

export class AuditLogListFilter {
  constructor(
    public query?: string,
    public creatorId?: string,
    public refType?: RefTypeEnum,
    public range: Date[] = [],
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
  }
}

export class AuditLog {

  readonly data: IAuditLog;
  private segmentService: SegmentService;
  private envUserService: EnvUserService;
  private previous: IFeatureFlag | string;
  private current: IFeatureFlag | string;

  htmlDiff: string = '';

  get targetData(): IFeatureFlag | string {
    switch (this.data.operation) {
      case AuditLogOpEnum.Create:
        return this.current;
      case AuditLogOpEnum.Remove:
        return this.previous;
      default:
        return this.current;
    }
  }

  constructor(data: IAuditLog, segmentService: SegmentService, envUserService: EnvUserService) {
    this.segmentService = segmentService;
    this.envUserService = envUserService;

    this.data = {...data};

    if (this.data.dataChange.previous?.length > 0) {
      try {
        this.previous = JSON.parse(this.data.dataChange.previous);
      } catch (e) {
        this.previous = this.data.dataChange.previous;
      }
    }

    if (this.data.dataChange.current?.length > 0) {
      try {
        this.current = JSON.parse(this.data.dataChange.current);
      } catch (e) {
        this.current = this.data.dataChange.current;
      }
    }

    if (this.shouldShowChangeList) {
      this.calculateHtmlDiff();
    }
  }

  async calculateHtmlDiff() {
    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        const previous = this.previous as IFeatureFlag;
        const current = this.current as IFeatureFlag;
        // get all end users
        const previousTargetUserIdRefs: string[] = previous.targetUsers.flatMap((v) => v.keyIds);
        const currentTargetUserIdRefs: string[] = current.targetUsers.flatMap((v) => v.keyIds);
        let targetUserIdRefs: string[] = [...previousTargetUserIdRefs, ...currentTargetUserIdRefs];
        targetUserIdRefs = targetUserIdRefs.filter((id, idx) => targetUserIdRefs.indexOf(id) === idx);

        // get all segmentIds from originalData and new Data
        const previousSegmentIdRefs: string[] = previous.rules.flatMap((rule) => rule.conditions)
          .filter((condition) => isSegmentCondition(condition) && condition.value.length > 0)
          .flatMap((condition: ICondition) => JSON.parse(condition.value))
          .filter((id) => id !== null && id.length > 0);

        const currentSegmentIdRefs: string[] = current.rules.flatMap((rule) => rule.conditions)
          .filter((condition) => isSegmentCondition(condition) && condition.value.length > 0)
          .flatMap((condition: ICondition) => JSON.parse(condition.value))
          .filter((id) => id !== null && id.length > 0);

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
        const [ _, diff]  = featureFlagDiffer.generateDiff(previous, current, {targetingUsers: refs[0], segments: refs[1]});
        this.htmlDiff = diff;
        return;
      default:
        break;
    }
  }

  get shouldShowChangeList(): boolean {
    return this.data.operation === AuditLogOpEnum.Update;
  }

  get auditLog() {
    return {...this.data};
  }

  get name(): string {
    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        return (this.targetData as IFeatureFlag).name;
      default:
        return (this.targetData as IFeatureFlag).name;
    }
  }

  get titlePrefix(): string {
    let result = this.data.creatorEmail;

    if (this.data.creatorName?.length > 0) {
      result += ` (${this.data.creatorName})`;
    }

    switch (this.data.operation) {
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
        result += ` ${this.data.operation}`;
    }

    switch (this.data.refType) {
      case RefTypeEnum.Flag:
        result += ` ${$localize `:@@auditlogs.idx.reftype-flag:the flag`}`;
        break;
      default:
        break;
    }

    return result;
  }
}
