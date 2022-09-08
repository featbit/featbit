import { Component, Input, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FlagTriggerService } from '@services/flag-trigger.service';
import { FlagTriggerAction, FlagTriggerStatus, FlagTriggerType, IFlagTrigger } from '../../types/flag-triggers';
import * as moment from 'moment';

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
    private message: NzMessageService) {
  }

  @Input() featureFlagId: string;
  triggers: IFlagTrigger[] = [];
  ngOnInit(): void {
    this.flagTriggerService.getTriggers(this.featureFlagId).subscribe(res => {
      this.triggers = res.map(r => {
        const trigger = Object.assign({}, r);
        trigger.typeName = this.getEnumName('type', r.type);
        trigger.actionName = this.getEnumName('action', r.action),
        trigger.statusName = this.getEnumName('status', r.status);
        trigger.updatedAt = moment(new Date(r.updatedAt)).format('YYYY-MM-DD HH:mm');
        trigger.lastTriggeredAt = r.lastTriggeredAt ? moment(new Date(r.lastTriggeredAt)).format('YYYY-MM-DD HH:mm') : null;
        trigger.triggerUrl = this.flagTriggerService.getTriggerUrl(trigger.token);
        return trigger;
      });
      this.isLoading = false;
    }, () => this.isLoading = false);
  }

  newFlagTrigger: IFlagTrigger = null;

  onCreateTrigger() {
    this.newFlagTrigger = {
      featureFlagId: this.featureFlagId,
      action: FlagTriggerAction.On,
      type: FlagTriggerType.GenericTrigger,
      status: FlagTriggerStatus.Enabled,
      description: ''
    };

    this.isCreationModalVisible = true;
  }

  private getEnumName(enumType: string, enu: FlagTriggerAction | FlagTriggerStatus | FlagTriggerType): string {
    switch(enumType){
      case 'action':
        return this.flagTriggerActions.find(f => f.id === enu).label;
      case 'type':
        return this.flagTriggerTypes.find(f => f.id === enu).label;
      case 'status':
        return this.flagTriggerStatus.find(f => f.id === enu).label;
    }
  }

  createTrigger() {
    this.isCreationLoading = true;
    this.flagTriggerService.createTrigger(this.newFlagTrigger).subscribe(res => {
      const trigger = Object.assign({}, res, {
        actionName: this.getEnumName('action', res.action),
        statusName: this.getEnumName('status', res.status),
        typeName: this.getEnumName('type', res.type),
        updatedAt: moment(res.updatedAt).format('YYYY-MM-DD HH:MM'),
        triggerUrl: this.flagTriggerService.getTriggerUrl(res.token),
        canCopyToken: true
      });

      this.message.success('成功创建新的触发器！');
      this.triggers = [trigger, ...this.triggers];
      this.isCreationLoading = false;
      this.isCreationModalVisible = false;
    }, (err) => {
      this.message.error('发生错误，请稍后再试！');
      this.isCreationLoading = false;
      this.isCreationModalVisible = false;
    });
  }

  cancelCreation() {
    this.isCreationModalVisible = false;
  }
  onChangeTriggerStatus(trigger: IFlagTrigger): void{
    if (trigger.statusName === 'Enabled'){
      this.toggleTriggerStatus(trigger, FlagTriggerStatus.Disabled, () => {
        this.message.success('成功关闭触发器！');
      });
    }else if (trigger.statusName === 'Disabled' ){
      this.toggleTriggerStatus(trigger, FlagTriggerStatus.Enabled, () => {
        this.message.success('成功激活触发器！');
      });
    }
  }

  disableTrigger(trigger: IFlagTrigger){
    this.toggleTriggerStatus(trigger, FlagTriggerStatus.Disabled, () => {
      this.message.success('成功关闭触发器！');
    });
  }

  enableTrigger(trigger: IFlagTrigger){
    this.toggleTriggerStatus(trigger, FlagTriggerStatus.Enabled, () => {
      this.message.success('成功激活触发器！');
    });
  }

  archiveTrigger(trigger: IFlagTrigger){
    this.toggleTriggerStatus(trigger, FlagTriggerStatus.Archived, () => {
      const idx = this.triggers.findIndex(f => f.id === trigger.id);
      this.triggers.splice(idx, 1);
      this.message.success('成功删除触发器！');
    });
  }

  resetToken(trigger: IFlagTrigger){
    this.flagTriggerService.resetTriggerToken(trigger.id, this.featureFlagId).subscribe(res => {
      trigger.token = res.token;
      trigger.triggerUrl = this.flagTriggerService.getTriggerUrl(res.token);
      trigger.canCopyToken = true;
      this.message.success('成功重置 URL！');
    });
  }

  private toggleTriggerStatus(trigger: IFlagTrigger, status: FlagTriggerStatus, callback?: () => void){
    this.flagTriggerService.updateTriggerStatus(trigger.id, this.featureFlagId, status).subscribe(res => {
      trigger.status = status;
      trigger.statusName = this.getEnumName('status', status);
      if (callback) {
        callback();
      }
    }, err => {
      this.message.error('发生错误，请稍后再试！');
    })
  }

  flagTriggerStatus = [
    {
      id: FlagTriggerStatus.Enabled,
      label: 'Enabled'
    },
    {
      id: FlagTriggerStatus.Disabled,
      label: 'Disabled'
    },
    {
      id: FlagTriggerStatus.Archived,
      label: 'Archived'
    }
  ];

  flagTriggerTypes = [
    {
       id: FlagTriggerType.GenericTrigger,
       label: '通用触发器'
    }
  ];

  flagTriggerActions = [
    {
      id: FlagTriggerAction.On,
      label: 'ON'
    }, {
      id: FlagTriggerAction.Off,
      label: 'OFF'
    }
  ]
}
