import { Component, Input, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FlagTriggerService } from '@services/flag-trigger.service';
import { FlagTriggerActionEnum, FlagTriggerTypeEnum, IFlagTrigger } from '../../types/flag-triggers';
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {FeatureFlagService} from "@services/feature-flag.service";
import { copyToClipboard } from "@utils/index";

@Component({
  selector: 'flag-triggers',
  templateUrl: './flag-triggers.component.html',
  styleUrls: ['./flag-triggers.component.less']
})
export class FlagTriggersComponent implements OnInit {

  isCreationModalVisible: boolean = false;
  isCreationLoading: boolean = false;
  isLoading = true;
  constructor(
    private flagTriggerService: FlagTriggerService,
    private featureFlagService: FeatureFlagService,
    private message: NzMessageService) {
  }

  @Input() featureFlagKey: string;
  featureFlagId: string;
  triggers: IFlagTrigger[] = [];
  ngOnInit(): void {
    this.featureFlagService.getByKey(this.featureFlagKey).subscribe((result: IFeatureFlag) => {
      this.featureFlagId = result.id;
      this.flagTriggerService.getList(this.featureFlagId).subscribe(res => {
        this.triggers = [...res];
        this.isLoading = false;
      }, () => this.isLoading = false);
    }, () => {
      this.isLoading = false;
      this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
    });
  }

  newFlagTrigger: IFlagTrigger = null;

  onCreateTrigger() {
    this.newFlagTrigger = {
      targetId: this.featureFlagId,
      action: FlagTriggerActionEnum.TurnOn,
      type: FlagTriggerTypeEnum.FeatureFlagGeneral,
      isEnabled: true,
      description: ''
    };

    this.isCreationModalVisible = true;
  }

  createTrigger() {
    this.isCreationLoading = true;
    this.flagTriggerService.create(this.newFlagTrigger).subscribe(res => {
      const trigger = {...res, canCopyToken: true};

      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.triggers = [trigger, ...this.triggers];
      this.isCreationLoading = false;
      this.isCreationModalVisible = false;
    }, (err) => {
      this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
      this.isCreationLoading = false;
      this.isCreationModalVisible = false;
    });
  }

  cancelCreation() {
    this.isCreationModalVisible = false;
  }

  onToggleTriggerStatus(trigger: IFlagTrigger): void{
    this.flagTriggerService.updateStatus(trigger.id, !trigger.isEnabled).subscribe(res => {
      trigger.isEnabled = !trigger.isEnabled;
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, err => {
      this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
    })
  }

  removeTrigger(trigger: IFlagTrigger){
    this.flagTriggerService.delete(trigger.id).subscribe(() => {
      this.triggers = this.triggers.filter(t => t.id !== trigger.id);
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, () => {
      this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
    });
  }

  resetToken(trigger: IFlagTrigger){
    this.flagTriggerService.resetToken(trigger.id).subscribe(token => {
      trigger.token = token;
      trigger.triggerUrl = this.flagTriggerService.getTriggerUrl(token);
      trigger.canCopyToken = true;
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, () => {
      this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
    });
  }

  getTriggerUrl(token: string): string {
    return this.flagTriggerService.getTriggerUrl(token);
  }

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  flagTriggerTypeLabel = {
    [FlagTriggerTypeEnum.FeatureFlagGeneral]: 'General'
  }

  flagTriggerTypes = [
    FlagTriggerTypeEnum.FeatureFlagGeneral
  ];

  flagTriggerActionLabel = {
    [FlagTriggerActionEnum.TurnOn]: 'ON',
    [FlagTriggerActionEnum.TurnOff]: 'OFF'
  }

  flagTriggerActions = [
    FlagTriggerActionEnum.TurnOn,
    FlagTriggerActionEnum.TurnOff
  ]
}
