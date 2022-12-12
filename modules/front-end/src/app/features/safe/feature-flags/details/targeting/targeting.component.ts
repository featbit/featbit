import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IOrganization, IProjectEnv } from '@shared/types';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CURRENT_ORGANIZATION, CURRENT_PROJECT } from "@utils/localstorage-keys";
import { EnvUserService } from '@services/env-user.service';
import { IUserProp, IUserType } from '@shared/types';
import { MessageQueueService } from '@services/message-queue.service';
import { EnvUserPropService } from "@services/env-user-prop.service";
import { USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP } from "@shared/constants";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";
import { FeatureFlag, IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ICondition, IRule, IRuleVariation } from "@shared/rules";
import { FeatureFlagService } from "@services/feature-flag.service";
import { uuidv4 } from "@utils/index";

@Component({
  selector: 'ff-targeting',
  templateUrl: './targeting.component.html',
  styleUrls: ['./targeting.component.less']
})
export class TargetingComponent implements OnInit {
  trackRuleById(_, rule: IRule) {
    return rule.id;
  }

  public featureFlag: FeatureFlag = {} as FeatureFlag;
  public userList: IUserType[] = [];

  userProps: IUserProp[];
  public key: string;
  public isLoading: boolean = true;
  public isTargetUsersActive: boolean = false;

  currentAccount: IOrganization = null;
  currentProjectEnv: IProjectEnv = null;

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

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService,
    private messageQueueService: MessageQueueService,
  ) {
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe(paramMap => {
      this.key = decodeURIComponent(paramMap.get('key'));
      this.messageQueueService.subscribe(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key), () => this.loadData());
      this.loadData();
    })
  }

  async loadData() {
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.currentAccount = JSON.parse(localStorage.getItem(CURRENT_ORGANIZATION()));

    await Promise.all([this.loadUserPropsData(), this.loadFeatureFlag()]);
    this.isLoading = false;
  }

  public targetingUsersByVariation: { [key: string]: IUserType[] } = {}; // {variationId: users}
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

        if (this.featureFlag.fallthrough.variations.length === 0) {
          this.featureFlag.fallthrough.variations = [{
            rollout: [0, 1],
            id: this.featureFlag.variations[0].id
          }];
        }

        this.featureFlagService.setCurrentFeatureFlag(this.featureFlag);
      }, () => {
        resolve(null);
      })
    });
  }

  private loadUserPropsData() {
    return new Promise((resolve) => {
      this.envUserPropService.get().subscribe((result) => {
        if (result) {
          this.userProps = [USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP, ...result];

          this.onSearchUser();

          resolve(null);
        }
      }, _ => {
        this.msg.error($localize `:@@common.loading-failed-try-again:Loading failed, please try again`);
        resolve(null);
      })
    });
  }

  public onSearchUser(filter: EnvUserFilter = new EnvUserFilter()) {
    this.envUserService.search(filter).subscribe(pagedResult => {
      this.userList = [...pagedResult.items];
    })
  }

  public onDeleteRule(ruleId: string) {
    this.featureFlag.rules = this.featureFlag.rules.filter(rule => rule.id !== ruleId);
  }

  public onAddRule() {
    this.featureFlag.rules.push({
      id: uuidv4(),
      name: ($localize `:@@common.rule:Rule`) + ' ' + (this.featureFlag.rules.length + 1),
      conditions: [],
      variations: [],
    } as IRule);
  }

  public onRuleConditionChange(conditions: ICondition[], ruleId: string) {
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

  public onSelectedUserListChange(data: IUserType[], variationId: string) {
    this.targetingUsersByVariation[variationId] = [...data];
  }

  public onFallthroughChange(value: IRuleVariation[]) {
    this.featureFlag.fallthrough.variations = [...value];
  }

  public onSave() {
    const validationErrs = this.validateFeatureFlag();

    if (validationErrs.length > 0) {
      this.msg.error(validationErrs[0]); // TODO display all messages by multiple lines
      return false;
    }

    this.isLoading = true;
    this.featureFlag.targetUsers = Object.keys(this.targetingUsersByVariation).map(variationId => ({variationId, keyIds: this.targetingUsersByVariation[variationId].map(tu => tu.keyId)}));

    const { id, targetUsers, rules, fallthrough, exptIncludeAllTargets } = this.featureFlag;

    this.featureFlagService.update({ id, targetUsers, rules, fallthrough, exptIncludeAllTargets }).subscribe({
      next: () => {
        this.loadData();
        this.msg.success($localize `:@@common.save-success:Saved Successfully`);
        this.messageQueueService.emit(this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.key));
      },
      error: () => {
        this.msg.error($localize `:@@common.save-fial:Failed to Save`);
        this.isLoading = false;
      }
    });
  }

  private validateFeatureFlag(): string[]  {
    const validatonErrs = [];

    // default value
    if (this.featureFlag.fallthrough === null || this.featureFlag.fallthrough.variations.length === 0) {
      validatonErrs.push($localize `:@@ff.components.details.targeting.fallthrough-mandatory:Fallthrough rule can not be empty`);
    }

    const fallthroughPercentage = this.featureFlag.fallthrough?.variations?.reduce((acc, curr: IRuleVariation) => {
      return acc + (curr.rollout[1] - curr.rollout[0]);
    }, 0);

    if (fallthroughPercentage !== undefined && fallthroughPercentage !== 1) {
      validatonErrs.push($localize `:@@ff.components.details.targeting.fallthrough-rollout-sum-must-be-100%:The sum of fallthrough rollout must be 100%`);
    }

    // rules
    this.featureFlag.rules.filter(f => f.conditions.length > 0).forEach((rule: IRule) => {
      const percentage = rule.variations.reduce((acc, curr: IRuleVariation) => {
        return acc + (curr.rollout[1] - curr.rollout[0]);
      }, 0);

      if (percentage !== 1) {
        validatonErrs.push($localize `:@@ff.components.details.targeting.rule-rollout-must-be-100%:The sum of each rule's rollout must be 100%`);
        return false;
      }
    })

    return validatonErrs;
  }


  public onRuleVariationsChange(value: IRuleVariation[], ruleId: string) {
    this.featureFlag.rules = this.featureFlag.rules.map(rule => {
      if (rule.id === ruleId) {
        rule.variations = [...value];
      }

      return rule;
    })
  }

  public onDragEnd(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.featureFlag.rules, event.previousIndex, event.currentIndex);
  }
}
