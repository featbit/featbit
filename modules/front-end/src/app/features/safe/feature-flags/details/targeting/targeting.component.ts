import { Component, OnInit, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IRuleIdDispatchKey, IUserProp, IUserType, License, LicenseFeatureEnum } from '@shared/types';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { EnvUserService } from '@services/env-user.service';
import { MessageQueueService } from '@services/message-queue.service';
import { EnvUserPropService } from "@services/env-user-prop.service";
import { USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP } from "@shared/constants";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";
import { FeatureFlag, IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ICondition, IRule, IRuleVariation } from "@shared/rules";
import { FeatureFlagService } from "@services/feature-flag.service";
import { isSegmentCondition, isSingleOperator, uuidv4 } from "@utils/index";
import { RefTypeEnum } from "@core/components/audit-log/types";
import { ChangeReviewOutput, ReviewModalKindEnum, ReviewModalMode } from "@core/components/change-review/types";
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";
import { environment } from "src/environments/environment";
import { getCurrentWorkspace } from "@utils/project-env";

enum FlagValidationErrorKindEnum {
  fallthrough = 0,
  rules = 1
}

interface IFlagValidationError {
  kind: FlagValidationErrorKindEnum,
  ids: string[],
  message: string
}

@Component({
  selector: 'ff-targeting',
  templateUrl: './targeting.component.html',
  styleUrls: ['./targeting.component.less']
})
export class TargetingComponent implements OnInit {
  trackRuleById(_, rule: IRule) {
    return rule.id;
  }

  license: License;
  featureFlag: FeatureFlag = {} as FeatureFlag;
  userList: IUserType[] = [];

  userProps: IUserProp[];
  key: string;
  isLoading: boolean = true;
  isTargetUsersActive: boolean = false;

  exptRulesVisible = false;

  onSetExptRulesClick() {
    this.exptRulesVisible = true;
  }

  async onSetExptRulesClosed(data: any) {
    if (data.isSaved) {
      this.isLoading = true;
      await this.loadFeatureFlag();
      this.isLoading = false;
    }

    this.exptRulesVisible = false;
  }

  reviewModalKind: ReviewModalKindEnum;
  originalData: string = '{}';
  currentData: string = '{}';
  refType: RefTypeEnum = RefTypeEnum.Flag;
  reviewModalVisible: boolean = false;


  onScheduleClick(validationErrortpl: TemplateRef<void>) {
    if (!this.license.isGranted(LicenseFeatureEnum.Schedule)) {
      return false;
    }

    return this.onReviewChanges(validationErrortpl, ReviewModalKindEnum.Schedule);
  }

  onChangeRequestClick(validationErrortpl: TemplateRef<void>) {
    if (!this.license.isGranted(LicenseFeatureEnum.ChangeRequest)) {
      return false;
    }

    return this.onReviewChanges(validationErrortpl, ReviewModalKindEnum.ChangeRequest);
  }

  onReviewChanges(validationErrortpl: TemplateRef<void>, modalKind: ReviewModalKindEnum) {
    this.validationErrors = this.validateFeatureFlag();

    if (this.validationErrors.length > 0) {
      this.msg.create('', validationErrortpl, { nzDuration: 5000 });
      return false;
    }

    this.reviewModalKind = modalKind;

    this.featureFlag.targetUsers = Object.keys(this.targetingUsersByVariation).map(variationId => ({variationId, keyIds: this.targetingUsersByVariation[variationId].map(tu => tu.keyId)}));
    this.originalData = JSON.stringify(this.featureFlag.originalData);
    this.currentData = JSON.stringify(this.featureFlag);

    this.reviewModalVisible = true
  }

  onCloseReviewModal() {
    this.reviewModalVisible = false;
  }

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService,
    private messageQueueService: MessageQueueService
  ) { }

  ngOnInit(): void {
    const workspace = getCurrentWorkspace();
    this.license = new License(workspace.license);

    this.isLoading = true;
    this.route.paramMap.subscribe(paramMap => {
      this.key = decodeURIComponent(paramMap.get('key'));
      this.messageQueueService.subscribe(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key), () => this.refreshFeatureFlag());
      this.loadData();
    });
  }

  private async refreshFeatureFlag() {
    this.featureFlagService.getByKey(this.key).subscribe({
      next: (result: IFeatureFlag) => {
        this.featureFlag.variations = [...result.variations];
        this.featureFlag.originalData.variations = [...result.variations];
        this.featureFlag.variations.forEach(v => {
          this.targetingUsersByVariation[v.id] = this.targetingUsersByVariation[v.id] ?? [];
        });
      },
      error: (err) => console.log('Error', err)
    })
  }

  async loadData() {
    await Promise.all([this.loadUserPropsData(), this.loadFeatureFlag(), this.loadPendingChangesList()]);
    this.isLoading = false;
  }

  targetingUsersByVariation: { [key: string]: IUserType[] } = {}; // {variationId: users}

  pendingChangesDrawerVisible: boolean = false;
  pendingChangesList: IPendingChanges[] = [];
  private async loadPendingChangesList() {
    try {
      this.pendingChangesList = await this.featureFlagService.getPendingChanges(this.key);
    } catch (err) {
      this.msg.error($localize`:@@common.loading-pending-changes-failed:Loading pending changes failed`);
    }
  }

  onPendingChangesRemoved(scheduleId: string) {
    this.pendingChangesList = this.pendingChangesList.filter(x => x.id !== scheduleId);
  }

  openPendingChangesDrawer() {
    this.pendingChangesDrawerVisible = true;
  }

  onPendingChangesDrawerClosed() {
    this.pendingChangesDrawerVisible = false;
  }

  loadFeatureFlag() {
    return new Promise((resolve) => {
      this.featureFlagService.getByKey(this.key).subscribe((result: IFeatureFlag) => {
        this.featureFlag = new FeatureFlag(result);
        this.isTargetUsersActive = this.featureFlag.targetUsers.some(tu => tu.keyIds.length > 0);

        const userKeyIds = this.featureFlag.targetUsers.flatMap(tu => tu.keyIds);
        if (userKeyIds.length > 0) {
          this.envUserService.getByKeyIds(userKeyIds).subscribe((users: IUserType[]) => {
            this.targetingUsersByVariation = this.featureFlag.variations.reduce((acc, cur) => {
              acc[cur.id] =  this.featureFlag.targetUsers
                .find(tu => tu.variationId === cur.id)
                ?.keyIds
                ?.map(keyId => users.find(u => u.keyId === keyId) || { id: keyId, keyId, name: keyId, customizedProperties: []}) || [];
              return acc;
            }, {});

            resolve(null);
          }, () => resolve(null));
        } else {
          this.targetingUsersByVariation = this.featureFlag.variations.reduce((acc, cur) => {
            acc[cur.id] = [];
            return acc;
          }, {});

          resolve(null);
        }
      }, () => {
        resolve(null);
      })
    });
  }

  private loadUserPropsData() {
    return new Promise((resolve) => {
      this.envUserPropService.get().subscribe({
        next: (result) => {
          if (result) {
            this.userProps = [USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP, ...result];

            this.onSearchUser();

            resolve(null);
          }
        },
        error: _ => {
          this.msg.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`);
          resolve(null);
        }
      });
    });
  }

  onSearchUser(filter: EnvUserFilter = new EnvUserFilter()) {
    this.envUserService.search(filter).subscribe(pagedResult => {
      this.userList = [...pagedResult.items];
    })
  }

  onAddProperty(prop: IUserProp) {
    this.envUserPropService.upsertProp(prop).subscribe(() => {
      this.userProps = [...this.userProps, prop];
    });
  }

  onDeleteRule(ruleId: string) {
    this.featureFlag.rules = this.featureFlag.rules.filter(rule => rule.id !== ruleId);
  }

  onAddRule() {
    this.featureFlag.rules.push({
      id: uuidv4(),
      name: ($localize `:@@common.rule:Rule`) + ' ' + (this.featureFlag.rules.length + 1),
      dispatchKey: null,
      conditions: [],
      variations: [],
    } as IRule);
  }

  onRuleConditionChange(conditions: ICondition[], ruleId: string) {
    this.featureFlag.rules = this.featureFlag.rules.map(rule => {
      if (rule.id === ruleId) {
        rule.conditions = conditions.map(condition => {
          const result = {...condition };

          if(result.type === 'multi') {
            result.value = JSON.stringify(result.multipleValue);
          }
          if(result.type === 'number') {
            result.value = result.value.toString();
          }

          return result;
        })
      }

      return rule;
    })
  }

  onSelectedUserListChange(data: IUserType[], variationId: string) {
    this.targetingUsersByVariation[variationId] = [...data];
  }

  onFallthroughChange(value: IRuleVariation[]) {
    this.featureFlag.fallthrough.variations = [...value];
  }

  onFallthroughDispatchKeyChangeChange(key: string) {
    this.featureFlag.fallthrough.dispatchKey = key;
  }

  onRuleDispatchKeyChange(ruleDispatchKey: IRuleIdDispatchKey) {
    this.featureFlag.rules = this.featureFlag.rules.map(rule => {
      if (rule.id === ruleDispatchKey.ruleId) {
        rule.dispatchKey = ruleDispatchKey.dispatchKey;
      }

      return rule;
    })
  }

  validationErrors: IFlagValidationError[] = [];

  onSave(data: ChangeReviewOutput) {
    this.isLoading = true;

    const { key, rules, fallthrough, exptIncludeAllTargets } = this.featureFlag;
    const targetUsers = this.featureFlag.targetUsers.filter(x => x.keyIds.length > 0);
    const targeting = { key, targetUsers, rules, fallthrough, exptIncludeAllTargets };

    const observer = {
      next: () => {
        this.loadData();
        this.msg.success($localize `:@@common.save-success:Saved Successfully`);
        this.messageQueueService.emit(this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.key));
      },
      error: () => {
        this.msg.error($localize `:@@common.save-fail:Failed to Save`);
        this.isLoading = false;
      }
    };

    if (!ReviewModalMode.isScheduleEnabled(this.reviewModalKind) && !ReviewModalMode.isChangeRequestEnabled(this.reviewModalKind)) {
      this.featureFlagService.updateTargeting(targeting, data.comment).subscribe(observer);
    } else if (ReviewModalMode.isScheduleEnabled(this.reviewModalKind)) { // schedule (with or without change request)
      this.featureFlagService.createSchedule(targeting, data.schedule.scheduledTime, data.schedule.title, data.changeRequest?.reviewers, data.changeRequest?.reason, ReviewModalMode.isChangeRequestEnabled(this.reviewModalKind)).subscribe(observer);
    } else if (ReviewModalMode.isChangeRequestEnabled(this.reviewModalKind)){ // change request only
      this.featureFlagService.createChangeRequest(targeting, data.changeRequest.reviewers, data.changeRequest.reason).subscribe(observer);
    } else {
      // error
    }

    this.reviewModalVisible = false;
  }

  isRuleInvalid(ruleId: string): boolean {
    return this.validationErrors.some((err) => err.kind === FlagValidationErrorKindEnum.rules && err.ids.includes(ruleId));
  }

  private validateFeatureFlag(): IFlagValidationError[]  {
    const validationErrs = [];

    // default value
    if (this.featureFlag.fallthrough === null || this.featureFlag.fallthrough.variations.length === 0) {
      validationErrs.push({
        kind: FlagValidationErrorKindEnum.fallthrough,
        ids: [],
        message: $localize `:@@ff.components.details.targeting.fallthrough-mandatory:Fallthrough rule can not be empty`
      });
    }

    const fallthroughPercentage = this.featureFlag.fallthrough?.variations?.reduce((acc, curr: IRuleVariation) => {
      return acc + (curr.rollout[1] - curr.rollout[0]);
    }, 0);

    if (fallthroughPercentage !== undefined && fallthroughPercentage !== 1) {
      validationErrs.push({
        kind: FlagValidationErrorKindEnum.fallthrough,
        ids: [],
        message: $localize `:@@ff.components.details.targeting.fallthrough-rollout-sum-must-be-100%:The sum of fallthrough rollout must be 100%`
      });
    }

    // rules
    const rulesWithoutConditions = this.featureFlag.rules.filter(f => f.conditions.length === 0);
    if (rulesWithoutConditions.length > 0) {
      validationErrs.push({
        kind: FlagValidationErrorKindEnum.rules,
        ids: rulesWithoutConditions.map((rule) => rule.id),
        message: $localize `:@@ff.components.details.targeting.rule-conditions-must-be-set:The conditions of each rule must be set`
      });
    }

    this.featureFlag.rules.filter(f => f.conditions.length > 0).forEach((rule: IRule) => {
      const invalidCondition = rule.conditions.some((condition) =>
        condition.property?.length === 0 || // property must be set
        (isSegmentCondition(condition.property) && JSON.parse(condition.value).length === 0) || // segment condition's value must be set
        (!isSegmentCondition(condition.property) && condition.op?.length === 0) || // non segment condition's operation must be set if not segment
        (!isSingleOperator(condition.op) && (condition.type === 'multi' ? JSON.parse(condition.value).length === 0 : condition.value?.length === 0)) // value must be set for non-single operator
      );

      if (invalidCondition) {
        validationErrs.push({
          kind: FlagValidationErrorKindEnum.rules,
          ids: [rule.id],
          message: $localize `:@@ff.components.details.targeting.rule-conditions-must-be-set:The conditions of each rule must be set`
        });
      }

      const percentage = rule.variations.reduce((acc, curr: IRuleVariation) => {
        return acc + (curr.rollout[1] - curr.rollout[0]);
      }, 0);

      if (percentage !== 1) {
        validationErrs.push({
          kind: FlagValidationErrorKindEnum.rules,
          ids: [rule.id],
          message: $localize `:@@ff.components.details.targeting.rule-rollout-must-be-100%:The sum of each rule's rollout must be 100%`
        });
      }
    })

    return validationErrs.filter((err, idx) => idx === validationErrs.findIndex((it) => it.kind === err.kind && it.ids.sort().join('') === err.ids.sort().join(''))); // return only unique values
  }

  onRuleVariationsChange(value: IRuleVariation[], ruleId: string) {
    this.featureFlag.rules = this.featureFlag.rules.map(rule => {
      if (rule.id === ruleId) {
        rule.variations = [...value];
      }

      return rule;
    })
  }

  onDragEnd(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.featureFlag.rules, event.previousIndex, event.currentIndex);
  }

  protected readonly environment = environment;
  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
  protected readonly ReviewModalKindEnum = ReviewModalKindEnum;
}
