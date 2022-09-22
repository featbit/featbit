import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {NzModalService} from 'ng-zorro-antd/modal';
import {SwitchService} from '@services/switch.service';
import {CSwitchParams, IFfParams, IVariationOption, VariationDataTypeEnum} from '../../types/switch-new';
import {IZeroCode} from '../../types/zero-code';
import {MessageQueueService} from '@services/message-queue.service';
import {SwitchV2Service} from '@services/switch-v2.service';
import {SwitchDetail, UpdateSettingPayload} from '@features/safe/feature-flags/types/switch-index';
import {IProjectEnv} from '@shared/types';
import {CURRENT_PROJECT} from '@utils/localstorage-keys';
import {isNumeric, tryParseJSONObject} from "@utils/index";
import {editor} from "monaco-editor";
import {DomSanitizer, SafeUrl} from "@angular/platform-browser";
import {DataSyncService} from "@services/data-sync.service";

@Component({
  selector: 'flag-setting',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.less']
})
export class SettingComponent implements OnInit {

  trackById(_, v: IVariationOption) {
    return v.localId;
  }

  compareWith(o1: IVariationOption, o2: IVariationOption): boolean {
    if (!o1 || !o2) {
      return false;
    }

    return o1?.localId === o2?.localId;
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.message.success('复制成功')
    );
  }

  public currentSwitch: IFfParams = null;
  public originalVariationOptions: IVariationOption[]; // this is used only for the return value when disabled
  public variationOptions: IVariationOption[];
  public variationDataType: VariationDataTypeEnum = VariationDataTypeEnum.string;
  private temporaryStateId: number = -1;
  public featureDetail: CSwitchParams;                      // 开关详情
  public isLoading = true;
  public isEditingTitle = false;
  public switchStatus: boolean = true;  // 开关状态
  public isEditingVariationOptions = false;
  public id: string = null;
  public quickStartDeliverFlag: boolean = false;
  tags: string[] = [];
  tutorial = '';
  currentProjectEnv: IProjectEnv = null;
  isArchived: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private switchServe: SwitchService,
    private switchServeV2: SwitchV2Service,
    private message: NzMessageService,
    private messageQueueService: MessageQueueService,
    private modal: NzModalService,
    private router: Router,
    private dataSyncService: DataSyncService,
    private sanitizer: DomSanitizer
  ) {
    this.isLoading = true;
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
      this.messageQueueService.subscribe(this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.id), () => this.loadData());
      this.loadData();
    })
  }
  editor?: editor.ICodeEditor | editor.IEditor;
  formatCode(e?: editor.ICodeEditor | editor.IEditor) {
    if (e) {
      this.editor = e;
    }

    // @ts-ignore
    setTimeout(async () => {
      if (this.expandReadonly) {
        this.editor.updateOptions({readOnly: false});
      }

      await this.editor.getSupportedActions().find(act => act.id === 'editor.action.formatDocument')?.run();
      this.editor.updateOptions({readOnly: this.expandReadonly});
    }, 100);
  }

  private loadData() {
    this.switchServeV2.getDetail(this.id).subscribe((result: SwitchDetail) => {
      this.featureDetail = new CSwitchParams(result.featureFlag);
      this.tags = result.tags || [];

      this.initSwitchStatus();
      this.variationOptions = this.featureDetail.getVariationOptions();
      this.originalVariationOptions = [...this.variationOptions];
      this.variationDataType = this.featureDetail.getVariationDataType();
      this.isArchived = this.featureDetail.getIsArchived();

      this.currentSwitch = this.featureDetail.getSwicthDetail();
      this.switchServe.setCurrentSwitch(this.currentSwitch);
      this.isLoading = false;
    }, () => this.isLoading = false)
  }

  // 初始化开关状态
  private initSwitchStatus() {
    this.switchStatus = this.featureDetail.getFeatureStatus() === 'Enabled';
  }

  openTutorial(lan: string): void {
    let config = {
      "react": "http://featureflag.moyincloud.com/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/React_Web_APP.html",
      "javascript": "http://featureflag.moyincloud.com/SDK/Javascript_Web_APP.html",
      "wechat-mini-program": "http://featureflag.moyincloud.com/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8.html",
      "python": "http://featureflag.moyincloud.com/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/Python_%E5%BA%94%E7%94%A8%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8.html",
      "java-server": "http://featureflag.moyincloud.com/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/Java_%E5%BA%94%E7%94%A8%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8.html",
      "spring-boot": "http://featureflag.moyincloud.com/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/Spring_Boot_%E5%BA%94%E7%94%A8%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8.html"
    };
    let href = config[lan];
    window.open(
      href,
      '_blank' // <- This is what makes it open in a new window.
    );
  }

  // 切换开关状态
  public onChangeSwitchStatus() {
    if (this.switchStatus){
      this.featureDetail.setFeatureStatus('Disabled');
    } else {
      this.featureDetail.setFeatureStatus('Enabled');
    }

    this.switchStatus = !this.switchStatus;
    this.onSaveSwitch(() => this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.id)));
  }

  onChangeDisabledStatusVariationOption() {
    this.onSaveSwitch(() => this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.id)));
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleVariationOptionEditState(): void {
    this.isEditingVariationOptions = !this.isEditingVariationOptions;
  }

  saveVariationOptions() {
    if (!this.validateVariationDataTypes()) {
      this.message.error("返回值类型与所填写内容不匹配，请改正后再保存！");
      return;
    }
    this.toggleVariationOptionEditState();
    this.onSaveSwitch(() => this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.id)));
  }

  zeroCode: IZeroCode = null;
  ngOnInit(): void {
    this.route.queryParamMap.subscribe(queryMap => {
      if (queryMap.has('tutorial')) {
        this.tutorial = queryMap.get('tutorial');
      }
    })
  }

  addVariationOption(): void {
    this.variationOptions = [
      ...this.variationOptions,
      {
        localId: this.temporaryStateId,
        displayOrder: null,
        variationValue: null
      }
    ];

    this.temporaryStateId -= 1;
  }

  currentEditingVariationOption: IVariationOption = null;
  optionValueExpandVisible = false;
  expandReadonly = true;
  expandVariationOption(v: IVariationOption, readonly: boolean = false) {
    this.currentEditingVariationOption = {...v};
    this.optionValueExpandVisible = true;
    this.expandReadonly = readonly;
  }

  saveOptionValue() {
    this.variationOptions = this.variationOptions.map(v => {
      return v.localId === this.currentEditingVariationOption.localId ? {...this.currentEditingVariationOption} : v
    });

    this.optionValueExpandVisible = false;
  }

  deleteVariationOptionRow(id: number): void {
    if(this.featureDetail.getTargetIndividuals()?.find(x => x.valueOption.localId === id)?.individuals?.length > 0) {
      this.message.warning("该状态已经在目标用户中被使用，移除后方可删除！");
      return;
    }

    if(this.featureDetail.getFftuwmtr().length > 0 && this.featureDetail.getFftuwmtr().find(x => x.valueOptionsVariationRuleValues.find(y => y.valueOption.localId === id))) {
      this.message.warning("该状态已经在匹配条件的规则中被使用，移除后方可删除！");
      return;
    }

    if(this.featureDetail.getFFDefaultRulePercentageRollouts().length > 0 && this.featureDetail.getFFDefaultRulePercentageRollouts().find(x => x.valueOption.localId === id)) {
      this.message.warning("该状态已经在默认返回值中被使用，移除后方可删除！");
      return;
    }

    if(this.featureDetail.getFFVariationOptionWhenDisabled() !== null && this.featureDetail.getFFVariationOptionWhenDisabled().localId === id) {
      this.message.warning("该状态已经在开关关闭后的返回值中被使用，移除后方可删除！");
      return;
    }

    if (this.zeroCode !== null && this.zeroCode?.items?.find(it => it.variationOption.localId === id)) {
      this.message.warning("该状态已经在零代码设置中被使用，移除后方可删除！");
      return;
    }

    this.variationOptions = this.variationOptions.filter(d => d.localId !== id);
  }

  isValidVariationOption(v: IVariationOption): boolean {
    return !!v && v.variationValue !== null && v.variationValue.trim() !== '' && this.validateVariationDataType(v.variationValue);
  }

  validateVariationDataTypes(): boolean {
      this.variationOptions = this.variationOptions.map(v => ({...v, isInvalid: !this.isValidVariationOption(v)}));
      return !this.variationOptions.some(v => v.isInvalid);
  }

  //!isNaN(parseFloat(num)) && isFinite(num);
  validateVariationDataType(value: string): boolean {
    switch (this.variationDataType) {
      case VariationDataTypeEnum.string:
        // the real value is alway string
        return value.trim().length > 0;
      case VariationDataTypeEnum.boolean:
        return value === 'true' || value === 'false';
      case VariationDataTypeEnum.number:
        return isNumeric(value);
      case VariationDataTypeEnum.json:
        const result = tryParseJSONObject(value);
        return result !== false;
      default:
        return false;
    }
  }

  // 更新开关名字
  onSaveSwitch(cb?: Function) {
    const { id, name, variationOptionWhenDisabled } = this.currentSwitch;
    const payload: UpdateSettingPayload = {name, status: this.featureDetail.getFeatureStatus(), variationOptionWhenDisabled } as UpdateSettingPayload;

    payload.variationDataType = this.variationDataType || VariationDataTypeEnum.string;
    this.variationOptions = this.variationOptions.filter(v => !v.isInvalid);
    // reset multistate id and order
    let maxId = Math.max(...this.variationOptions.map(x => x.localId));
    this.variationOptions.forEach((e, i) => {
      if (e.localId < 0) {
        maxId += 1;
        e.localId = maxId;
      }

      e.displayOrder = i + 1;
    });


    payload.variationOptions = this.variationOptions;

    this.switchServeV2.updateSetting(id, payload)
      .subscribe((result: IFfParams) => {
        this.currentSwitch = result;
        this.switchServe.setCurrentSwitch(result);
        this.message.success("开关信息更新成功!");
        this.isEditingTitle = false;
        this.originalVariationOptions = [...this.variationOptions];
        cb && cb();
      }, errResponse => this.message.error(errResponse.error));
  }

  // 存档
  onArchiveClick() {
    const disabledValue = this.currentSwitch.variationOptionWhenDisabled.variationValue;

    this.modal.confirm({
      nzContent: `存档后开关将从开关列表中移除，开关将处于 <strong>关闭状态</strong> 且返回值将变为 <strong>${disabledValue}</strong> 。请您再次确认以避免给线上环境造成影响。`,
      nzTitle: '确定存档开关么？',
      nzCentered: true,
      nzClassName: 'information-modal-dialog',
      nzOnOk: () => {
        this.switchServe.archiveEnvFeatureFlag(this.currentSwitch.id, this.currentSwitch.name)
          .subscribe(
            _ => {
              this.message.success('开关存档成功！');
              this.isArchived = true;
              this.switchStatus = false;
              this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.id));
            },
            _ => {
              this.message.error('开关存档失败，请稍后重试！');
            }
          );
      }
    });
  }

  // 复位开关
  restoreFlag() {
    this.switchServe.unarchiveEnvFeatureFlag(this.id, this.currentSwitch.name).subscribe(_ => {
      this.message.success('开关复位成功！');
      this.isArchived = false;
      this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.id));
    });
  }

  // 删除开关
  deleteFlag() {
    this.switchServeV2.delete(this.id).subscribe(success => {
      if (success) {
        this.message.success('删除成功');
        this.router.navigateByUrl('/feature-flags');
      } else {
        this.message.error('删除失败，请联系运营人员。');
      }
    });
  }

  isExportingVariationUsers: boolean = false;
  downloadFileName: string = null;
  downloadUri: SafeUrl = null;
  @ViewChild('downloadRef', { static: false })
  downloadRef: ElementRef;


  onExportVariationUsers(variation: IVariationOption) {
    this.isExportingVariationUsers = true;
    const downloadFilename = `featureflag.co.${this.currentSwitch.name}_${variation.variationValue}.csv`;
    this.switchServeV2.getUsersForVariation(this.currentSwitch.id, variation.localId).subscribe(data => {
      this.downloadFile(downloadFilename, data);
    }, _ => {
      this.isExportingVariationUsers = false;
      this.message.error("数据下载失败！");
    });
  }

  downloadFile(name: string, data) {
    this.downloadFileName = name;
    this.downloadUri = this.sanitizer.bypassSecurityTrustUrl("data:application/csv;charset=UTF-8," + encodeURIComponent(data));

    window.setTimeout(() => {
      this.isExportingVariationUsers = false;
      this.downloadRef.nativeElement.click();
      this.downloadUri = null;
    }, 0);
  }
}
