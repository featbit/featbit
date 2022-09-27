import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { forkJoin } from 'rxjs';
import { SwitchService } from '@services/switch.service';
import { CSwitchParams, IFfParams, IFfpParams, IJsonContent, IVariationOption, IRulePercentageRollout, IPrequisiteFeatureFlag, IFftuwmtrParams } from '../../types/switch-new';
import { PendingChange } from '../../types/pending-changes';
import { TeamService } from '@services/team.service';
import { IOrganization, IProjectEnv } from '@shared/types';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CURRENT_ACCOUNT, CURRENT_PROJECT } from "@utils/localstorage-keys";
import { EnvUserService } from '@services/env-user.service';
import { IUserProp, IUserType } from '@shared/types';
import { MessageQueueService } from '@services/message-queue.service';
import { EnvUserPropService } from "@services/env-user-prop.service";
import featureFlagDiffer from '../../types/feature-flag-differ';
import {USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP} from "@shared/constants";
import {EnvUserFilter} from "@features/safe/users/types/featureflag-user";

@Component({
  selector: 'switch-targeting',
  templateUrl: './targeting.component.html',
  styleUrls: ['./targeting.component.less']
})
export class TargetingComponent implements OnInit {
  trackRuleById(_, rule: IFftuwmtrParams) {
    return rule.ruleId;
  }

  public switchStatus: 'Enabled' | 'Disabled' = 'Enabled';  // 开关状态
  public featureList: IPrequisiteFeatureFlag[] = [];                     // 开关列表
  public featureDetail: CSwitchParams;                      // 开关详情
  public upperFeatures: IFfpParams[] = [];                  // 上游开关列表
  public userList: IUserType[] = [];                        // 用户列表

  // 用户属性列表
  userProps: IUserProp[];

  public switchId: string;
  public isLoading: boolean = true;
  public variationOptions: IVariationOption[] = [];                         // multi state
  public targetIndividuals: { [key: string]: IUserType[] } = {}; // multi state
  public targetIndividualsActive: boolean = false;

  public isArchived = false;
  currentAccount: IOrganization = null;
  currentProjectEnv: IProjectEnv = null;

  approvalRequestEnabled: boolean = false;

  flagSchedulerSubscriptionFlag: string = "基础版";
  flagApprovalRequestSubscriptionFlag: string = "基础版";

  exptRulesVisible = false;


  onSetExptRulesClick() {
    this.exptRulesVisible = true;
  }

  onSetExptRulesClosed(data: any) {
    if (data.isSaved) {
      this.isLoading = true;
      this.switchServe.getSwitchDetail(this.featureDetail.getSwicthDetail().id).subscribe((result: CSwitchParams) => {
        this.loadFeatureFlag(result);
        this.isLoading = false;
      }, () => {
        this.isLoading = false;
      });
    }

    this.exptRulesVisible = false;
  }

  constructor(
    private route: ActivatedRoute,
    private switchServe: SwitchService,
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService,
    private messageQueueService: MessageQueueService,
    private teamService: TeamService,
    private modal: NzModalService
  ) {
    this.approvalRequestEnabled = false;
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe(paramMap => {
      this.switchId = decodeURIComponent(paramMap.get('id'));
      this.messageQueueService.subscribe(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.switchId), () => this.fetchFlag());
      this.fetchFlag(() => this.isLoading = false);
    })
  }

  fetchFlag(complete?: Function) {
    this.switchServe.getSwitchDetail(this.switchId).subscribe((result: CSwitchParams) => {
      this.loadFeatureFlag(result);
      this.initData(complete);
    }, () => {
      this.isLoading = false;
    })
  }

  private initData(complete?: Function) {
    forkJoin([
      this.envUserPropService.getProp(),
      this.switchServe.getSwitchList(this.switchServe.envId)
    ]).subscribe((result) => {
      if (result) {
        this.userProps = [USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP, ...result[0]];

        this.featureList = result[1];
        this.pendingChanges.setFeatureFlagList(this.featureList);

        this.initSwitchStatus();
        this.initUpperSwitch();

        this.onSearchUser();
        this.onSearchPrequisiteFeatureFlags();

        this.switchServe.setCurrentSwitch(this.featureDetail.getSwicthDetail());
        complete && complete();
      }
    }, _ => {
      this.msg.error("数据加载失败，请重试!");
      complete && complete();
    })
  }

  private originalData: CSwitchParams;
  private loadFeatureFlag(ff: CSwitchParams) {
    this.originalData = new CSwitchParams(JSON.parse(JSON.stringify(ff)));
    this.featureDetail = new CSwitchParams(ff);
    this.isArchived = this.featureDetail.getIsArchived();
    // set prerequiste
    const upperFeatures = this.featureDetail.getUpperFeatures().map(u => {
      u.selectedFeatureFlag = this.featureList.find(d => d.id === u.prerequisiteFeatureFlagId);
      return u;
    });
    this.featureDetail.setUpperFeatures(upperFeatures);

    this.variationOptions = this.featureDetail.getVariationOptions();
    this.targetIndividuals = this.variationOptions.reduce((acc, cur) => {
      acc[cur.localId] = this.featureDetail.getTargetIndividuals().filter(t => t.valueOption !== null).find(ti => ti.valueOption.localId === cur.localId)?.individuals || [];
      return acc;
    }, {});
    for (const i in this.targetIndividuals) {
      if (this.targetIndividuals[i].length !== 0) {
        this.targetIndividualsActive = true;
        break;
      }
    }
    if (this.featureDetail.getFFDefaultRulePercentageRollouts().length === 0) {
      this.featureDetail.setFFDefaultRulePercentageRollouts([
        {
          rolloutPercentage: [0, 1],
          valueOption: this.variationOptions[0]
        }
      ]);
    }

    const detail: IFfParams = this.featureDetail.getSwicthDetail();
    this.switchServe.setCurrentSwitch(detail);
    this.switchId = detail.id;

    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.currentAccount = JSON.parse(localStorage.getItem(CURRENT_ACCOUNT()));
    const currentUrl = this.route.snapshot['_routerState'].url;
    this.pendingChanges = new PendingChange(
      this.teamService,
      this.currentAccount.id,
      this.currentProjectEnv,
      detail,
      this.variationOptions,
      currentUrl.substr(0, currentUrl.lastIndexOf('/') + 1)
    );

    this.pendingChanges.initialize(
      this.targetIndividuals,
      this.featureDetail.getFFVariationOptionWhenDisabled(),
      this.featureDetail.getFFDefaultRulePercentageRollouts(),
      this.featureDetail.getFftuwmtr(),
      this.featureDetail.getUpperFeatures(),
      this.featureDetail.getFeatureStatus()
    );
  }

  // -------------------------------------------------------------------------------------------------

  // 初始化开关状态
  private initSwitchStatus() {
    this.switchStatus = this.featureDetail.getFeatureStatus();
  }

  // 切换开关状态
  public onChangeSwitchStatus(type: 'Enabled' | 'Disabled') {
    this.switchStatus = type;
    if (type === 'Enabled') {
      this.featureDetail.setFeatureStatus('Disabled');
    } else if (type === 'Disabled') {
      this.featureDetail.setFeatureStatus('Enabled');
    }
  }

  // 初始化上游开关
  private initUpperSwitch() {
    this.upperFeatures = [...this.featureDetail.getUpperFeatures()];
  }

  // 上游开关发生改变
  public onUpperSwicthChange(data: IFfpParams[]) {
    this.upperFeatures = [...data];
    this.featureDetail.setUpperFeatures(this.upperFeatures);
  }

  // 搜索用户
  public onSearchUser(searchText: string = '') {
    const filter = new EnvUserFilter(searchText, ['Name', 'KeyId'], 1, 5);
    this.envUserService.search(filter).subscribe(pagedResult => {
      this.userList = [...pagedResult.items];
    })
  }

  // 搜索用户
  public onSearchPrequisiteFeatureFlags(value: string = '') {
    this.switchServe.queryPrequisiteFeatureFlags(value)
      .subscribe((result: IPrequisiteFeatureFlag[]) => {
        this.featureList = [...result.filter(r => r.id !== this.featureDetail.getSwicthDetail().id)];
      })
  }


  public onVariationOptionWhenDisabledChange(option: IVariationOption) {
    this.featureDetail.setFFVariationOptionWhenDisabled(option);
  }

  // 删除规则
  public onDeleteRule(index: number) {
    this.featureDetail.deleteFftuwmtr(index);
  }

  // 添加规则
  public onAddRule() {
    this.featureDetail.addFftuwmtr();
  }

  // 规则字段发生改变
  public onRuleConfigChange(value: IJsonContent[], index: number) {
    this.featureDetail.setConditionConfig(value, index);
  }

  /****multi state* */

  public onMultistatesSelectedUserListChange(data: IUserType[], variationOptionId: number) {
    this.targetIndividuals[variationOptionId] = [...data];
  }


  // 默认返回值配置
  public onDefaultRulePercentageRolloutsChange(value: IRulePercentageRollout[]) {
    this.featureDetail.setFFDefaultRulePercentageRollouts(value);
  }

  public onPreSaveConditions() {
    const validationErrs = this.featureDetail.checkMultistatesPercentage();

    if (validationErrs.length > 0) {
      this.msg.error(validationErrs[0]); // TODO display all messages by multiple lines
      return false;
    }

    if (!this.sortoutSubmitData()) {
      return;
    }

    this.pendingChanges.generateInstructions(
      this.targetIndividuals,
      this.featureDetail.getFFVariationOptionWhenDisabled(),
      this.featureDetail.getFFDefaultRulePercentageRollouts(),
      this.featureDetail.getFftuwmtr(),
      this.featureDetail.getUpperFeatures(),
      this.featureDetail.getFeatureStatus()
    );

    this.isApprovalRequestModal = false;
    this.requestApprovalModalVisible = true;
  }

  public onSaveConditionsOld() {
    const validationErrs = this.featureDetail.checkMultistatesPercentage();

    if (validationErrs.length > 0) {
      this.msg.error(validationErrs[0]); // TODO display all messages by multiple lines
      return false;
    }

    if (!this.sortoutSubmitData()) {
      return;
    }

    this.onSaveConditions();
  }

  public onSaveConditions() {
    this.isLoading = true;
    this.featureDetail.setTargetIndividuals(this.targetIndividuals);

    this.switchServe.updateSwitch(this.featureDetail)
      .subscribe((result) => {
        this.msg.success("修改成功!");
        this.loadFeatureFlag(result.data);
        this.requestApprovalModalVisible = false;
        this.messageQueueService.emit(this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.switchId));
        this.isLoading = false;
      }, _ => {
        this.msg.error("修改失败!");
        this.requestApprovalModalVisible = true;
        this.isLoading = false;
      })
  }

  private sortoutSubmitData(): boolean {
    try {
      this.featureDetail.onSortoutSubmitData();
      return true;
    } catch (e) {
      this.msg.warning("请确保所填数据完整!");
      return false;
    }
  }

  public onPercentageChangeMultistates(value: IRulePercentageRollout[], index: number) {
    this.featureDetail.setRuleValueOptionsVariationRuleValues(value, index);
  }

  /***************************Request approval********************************/
  requestApprovalModalVisible: boolean = false;
  pendingChanges: PendingChange;
  isApprovalRequestModal = false;
  pChanges: string = '';
  numChanges: number = 0;
  public onRequestApproval() {
    let nzContent = "请求审阅允许将规则配置的修改被同事审核后再被执行，如同 DevOps 或 Git 管理的 Pull Request 功能。";
    if (this.flagApprovalRequestSubscriptionFlag == "开发用") {
      if (!this.sortoutSubmitData()) {
        return;
      }

      // TODO example code to generate PR diff
      // this.featureDetail.setTargetIndividuals(this.targetIndividuals);
      // const [ numChanges, changes]  = featureFlagDiffer.generateDiff(this.originalData, this.featureDetail);
      // this.numChanges = numChanges;
      // this.pChanges = changes;

      this.pendingChanges.generateInstructions(
        this.targetIndividuals,
        this.featureDetail.getFFVariationOptionWhenDisabled(),
        this.featureDetail.getFFDefaultRulePercentageRollouts(),
        this.featureDetail.getFftuwmtr(),
        this.featureDetail.getUpperFeatures(),
        this.featureDetail.getFeatureStatus()
      );
      this.requestApprovalModalVisible = true;
      this.isApprovalRequestModal = true;
    }
    else if (this.flagApprovalRequestSubscriptionFlag != "企业版") {
      this.modal.warning({
        nzTitle: '此功能只针对企业版用户开放',
        nzContent: nzContent + '此模块目前只针对企业版用户开放，可以联系我们的客户经理、客服或通过官网 https://featureflag.co 的《预约咨询》升级您的订阅计划。',
        nzClassName: 'information-modal-dialog'
      });
    }
    else if (this.flagApprovalRequestSubscriptionFlag == "企业版") {
      this.modal.info({
        nzTitle: '此功能还在开发中',
        nzContent: nzContent + '我们正在致力于这个模块的实现，若您希望我们加快速度，可以及时与我们的客户成功专员联系。',
        nzClassName: 'information-modal-dialog'
      });
    }
  }

  public onFlagScheduler() {
    let nzContent = "定时发布允许将一个配置在一个指定时间被执行，如深夜中发布某个功能给某个用户组。";
    if (this.flagSchedulerSubscriptionFlag != "企业版") {
      this.modal.warning({
        nzTitle: '此功能只针对企业版用户开放',
        nzContent: nzContent + '此模块目前只针对企业版用户开放，可以联系我们的客户经理、客服或通过官网 https://featureflag.co 的《预约咨询》升级您的订阅计划。',
        nzClassName: 'information-modal-dialog'
      });
    }
    else if (this.flagSchedulerSubscriptionFlag == "企业版") {
      this.modal.info({
        nzTitle: '此功能还在开发中',
        nzContent: nzContent + '我们正在致力于这个模块的实现，若您希望我们加快速度，可以及时与我们的客户成功专员联系。',
        nzClassName: 'information-modal-dialog',
      });
    }
  }

  // 拖放完成
  public onDragEnd(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.featureDetail.getFftuwmtr(), event.previousIndex, event.currentIndex);
  }
}
