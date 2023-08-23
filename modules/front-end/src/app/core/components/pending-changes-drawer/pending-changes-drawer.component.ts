import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";
import { RefTypeEnum } from "@core/components/audit-log/types";
import { IUserType } from "@shared/types";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { isSegmentCondition } from "@utils/index";
import { ICondition } from "@shared/rules";
import { lastValueFrom } from "rxjs";
import { DiffFactoryService } from "@services/diff-factory.service";
import { SegmentService } from "@services/segment.service";
import { EnvUserService } from "@services/env-user.service";
import { IChangeListParam, IInstruction } from "@core/components/change-list-v2/instructions/types";
import { INSTRUCTIONS } from "@core/components/pending-changes-drawer/data";

interface IChangeCategory {
  createdAt: string;
  scheduledTime: string;
  creator: string;
  instructions: IInstruction[];
  previous: IFeatureFlag | ISegment;
  current: IFeatureFlag | ISegment;
}

@Component({
  selector: 'pending-changes-drawer',
  templateUrl: './pending-changes-drawer.component.html',
  styleUrls: ['./pending-changes-drawer.component.less']
})
export class PendingChangesDrawerComponent implements OnInit {
  private userRefs: IUserType[] = [];
  private segmentRefs: ISegment[] = [];

  changeCategoriesList: IChangeCategory[] = [];

  @Input() visible: boolean = false;
  @Input()
  set pendingChangesList(data: IPendingChanges[]) {
    this.changeCategoriesList = [];
    data.map(async (item: IPendingChanges) => {
      const previous: IFeatureFlag = JSON.parse(item.dataChange.previous);
      const current: IFeatureFlag = JSON.parse(item.dataChange.current);

      this.changeCategoriesList.push({
        createdAt: item.createdAt,
        scheduledTime: item.scheduledTime,
        creator: item.creatorName,
        previous: previous,
        current: current,
        instructions: item.instructions,
      });
    });
  }
  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private diffFactoryService: DiffFactoryService,
    private segmentService: SegmentService,
    private envUserService: EnvUserService
  ) { }

  param: IChangeListParam;

  ngOnInit(): void {
  }

  onClose() {
    this.close.emit();
  }

  async calculateHtmlDiff(pendingChanges: IPendingChanges) {
    let targetUserIdRefs: string[];

    const previous: IFeatureFlag = JSON.parse(pendingChanges.dataChange.previous);
    const current: IFeatureFlag = JSON.parse(pendingChanges.dataChange.current);

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

    return this.diffFactoryService.getDiffer(RefTypeEnum.Flag).diff(pendingChanges.dataChange.previous, pendingChanges.dataChange.current, {targetingUsers: this.userRefs, segments: this.segmentRefs});
  }

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
}
