import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { EnvUserService } from '@services/env-user.service';
import { SegmentService } from '@services/segment.service';
import { IUserProp, IUserType } from '@shared/types';

import { ISegment, ISegmentFlagReference, Segment } from '../../types/segments-index';
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { EnvUserPropService } from "@services/env-user-prop.service";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";
import { ICondition, IRule } from "@shared/rules";
import { getPathPrefix } from "@utils/index";
import { RefTypeEnum } from "@core/components/audit-log/types";
import { getCurrentProjectEnv } from "@utils/project-env";
import { finalize } from 'rxjs';

@Component({
    selector: 'segment-targeting',
    templateUrl: './targeting.component.html',
    styleUrls: ['./targeting.component.less'],
    standalone: false
})
export class TargetingComponent implements OnInit {
  public segmentDetail: Segment;
  public userList: IUserType[] = [];
  public isLoading: boolean = true;
  public isUserPropsLoading: boolean = true;
  public id: string;
  public targetUsersActive = true;
  public flagReferences: ISegmentFlagReference[] = [];

  originalData: string = '{}';
  currentData: string = '{}';
  refType: RefTypeEnum = RefTypeEnum.Segment;
  reviewModalVisible: boolean = false;

  onReviewChanges() {
    this.originalData = JSON.stringify(this.segmentDetail.originalData);
    this.currentData = JSON.stringify(this.segmentDetail.dataToSave);

    this.reviewModalVisible = true;
  }

  onCloseReviewModal() {
    this.reviewModalVisible = false;
  }

  currentEnvId: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private segmentService: SegmentService,
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService
  ) {
    // user properties
    this.envUserPropService.get().subscribe(properties => {
      this.userProps = properties;
      this.isUserPropsLoading = false;
    }, () => this.isUserPropsLoading = false);
  }

  ngOnInit(): void {
    this.currentEnvId = getCurrentProjectEnv().envId;

    this.route.paramMap.subscribe(paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
      this.loadData();
      this.segmentService.getFeatureFlagReferences(this.id).subscribe((flags: ISegmentFlagReference[]) => {
        this.flagReferences = [...flags];
      });
    })
  }

  private async loadData() {
    return this.segmentService.getSegment(this.id).subscribe((result: ISegment) => {
      if (result) {
        this.id = result.id;
        this.loadSegment(result);
      }
    })
  }

  public openFlagPage(flag: ISegmentFlagReference) {
    if (flag.envId !== this.currentEnvId) {
      return;
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/${getPathPrefix()}feature-flags/${flag.key}/targeting`])
    );

    window.open(url, '_blank');
  }

  private loadSegment(segment: ISegment) {
    this.segmentDetail = new Segment(segment);
    // load users
    const userKeyIds = [...segment.included, ...segment.excluded];
    if (userKeyIds.length > 0) {
      this.envUserService.getByKeyIds(userKeyIds).subscribe((users: IUserType[]) => {
        this.segmentDetail.includedUsers = this.segmentDetail.segment.included.map(keyId => users.find(u => u.keyId === keyId) ?? this.createGlobalUser(keyId));
        this.segmentDetail.excludedUsers = this.segmentDetail.segment.excluded.map(keyId => users.find(u => u.keyId === keyId) ?? this.createGlobalUser(keyId));

        this.isLoading = false;
      });
    } else {
      this.isLoading = false;
    }
  }

  private createGlobalUser(keyId: string): IUserType {
    return { id: '', keyId, name: keyId, envId: null };
  }

  public onSearchUser(filter: EnvUserFilter = new EnvUserFilter()) {
    // shared segment can only reference global users
    filter.globalUserOnly = this.segmentDetail.isShared;

    this.envUserService.search(filter).subscribe(pagedResult => {
      this.userList = [...pagedResult.items];
    })
  }

  public onSelectedUserListChange(data: IUserType[], isIncluded: boolean) {
    if (isIncluded) {
      this.segmentDetail.includedUsers = data;
    } else {
      this.segmentDetail.excludedUsers = data;
    }
  }

  public onSave(data: any) {
    this.isLoading = true;

    const { included, excluded, rules } = this.segmentDetail.dataToSave;
    const payload = {
      included,
      excluded,
      rules,
      comment: data.comment
    };

    this.segmentService.updateTargeting(this.id, payload)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => this.msg.success($localize`:@@common.operation-success:Operation succeeded`),
        error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
      });

    this.reviewModalVisible = false;
  }

  userProps: IUserProp[] = [];

  trackRuleById(_, rule: IRule) {
    return rule.id;
  }

  addRule() {
    this.segmentDetail.newRule();
  }

  onAddProperty(prop: IUserProp) {
    this.envUserPropService.upsertProp(prop).subscribe(() => {
      this.userProps = [...this.userProps, prop];
    });
  }

  deleteRule(index: number) {
    this.segmentDetail.removeRule(index);
  }

  onRuleConditionsChange(conditions: ICondition[], index: number) {
    this.segmentDetail.updateRuleConditions(conditions, index);
  }

  onDrop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.segmentDetail.rules, event.previousIndex, event.currentIndex);
  }
}
