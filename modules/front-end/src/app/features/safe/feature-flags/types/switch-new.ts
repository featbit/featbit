import { IUserType } from "@shared/types";
import { uuidv4 } from "@shared/utils";

export enum FeatureFlagType {
  Classic = 1,
  Pretargeted = 2 // 已经预分流，无需我们的开关做用户分流
}

export interface IPrequisiteFeatureFlag {
  id: string;
  name: string;
  keyName: string;
  environmentId: number;
  variationOptions: IVariationOption[]
}

export interface IFfParams {
    id: string;
    name: string;
    type: FeatureFlagType;
    keyName: string;
    environmentId: number;
    creatorUserId: string;
    status: 'Enabled' | 'Disabled';
    lastUpdatedTime: string;
    // multi states
    variationOptionWhenDisabled: IVariationOption;
    defaultRulePercentageRollouts: IRulePercentageRollout[];
    isDefaultRulePercentageRolloutsIncludedInExpt: boolean;
}

export interface IFfSettingParams {
  id: string;
  name: string;
  status: string;
  environmentId: number,
  variationOptionWhenDisabled: IVariationOption,
  variationOptions?: IVariationOption[] // not null only when nulti state feature flag
}

export interface IFfpParams {
    prerequisiteFeatureFlagId: string;
    valueOptionsVariationValue?: IVariationOption;
    selectedFeatureFlag?: IPrequisiteFeatureFlag;
}

export interface IFftiuParams {
    id: string;
    name: string;
    keyId: string;
    email: string;
}

export interface IJsonContent {
    property: string;
    operation: string;
    value: string;

    multipleValue?: string[];
    type?: string;
}

export interface IFftuwmtrParams {
    id: string;
    name: string;
    conditions: IJsonContent[];
    variations: IRulePercentageRollout[];
    includedInExpt?: boolean; // TODO this is not optional
}

export interface IVariationOption {
  localId: number;
  value: string;

  // ui only
  isInvalid?: boolean
}

export interface ITargetIndividualForVariationOption {
  individuals: IFftiuParams[];
  valueOption: IVariationOption;
}

export interface IRulePercentageRollout {
  localId: number;
  value: string;
  rollout: number[]; // only two elements, start and end
  exptRollout?: number; // 0.45 means 45% TODO this is not optional

  // UI only
  percentage?: number; // the percentage representation of rolloutPercentage
  exptPercentage?: number;  // the percentage representation of exptRollout
}

export enum VariationDataTypeEnum {
  string = 'string',
  json = 'json',
  number = 'number',
  boolean = 'boolean',
}

export class CSwitchParams {
    private id: string;
    private environmentId: number;
    private objectType: string;

    private ff: IFfParams;
    private ffp: IFfpParams[];
    private fftiuForFalse: IFftiuParams[];
    private fftiuForTrue: IFftiuParams[];
    private fftuwmtr: IFftuwmtrParams[];
    private targetIndividuals: ITargetIndividualForVariationOption[];
    private variationOptions: IVariationOption[];
    private variationDataType: VariationDataTypeEnum;
    private exptIncludeAllRules: boolean;
    private isArchived = false;

    constructor(data: CSwitchParams) {

        this.id = data.id;
        this.environmentId = data.environmentId;
        this.objectType = data.objectType;

        this.isArchived = data.isArchived;
        this.ff = data.ff;
        this.ffp = data.ffp;
        this.fftiuForFalse = data.fftiuForFalse;
        this.fftiuForTrue = data.fftiuForTrue;
        this.fftuwmtr = data.fftuwmtr;

        this.variationOptions = data.variationOptions?.sort((a, b) => a.displayOrder - b.displayOrder);
        this.variationDataType = data.variationDataType || VariationDataTypeEnum.string;
        this.targetIndividuals = data.targetIndividuals;

        this.exptIncludeAllRules = data.exptIncludeAllRules === undefined || data.exptIncludeAllRules === null ? true : data.exptIncludeAllRules;
    }

    public getIsArchived(): boolean {
      return this.isArchived;
    }

    // 设置当前开关状态
    public setFeatureStatus(status: 'Enabled' | 'Disabled') {
        this.ff.status = status;
    }

    // 获取当前开关状态
    public getFeatureStatus(): 'Enabled' | 'Disabled' {
        return this.ff.status;
    }

    // 设置上游开关列表
    public setUpperFeatures(data: IFfpParams[]) {
        this.ffp = [...data];
    }

    // 获取上游开关列表
    public getUpperFeatures(): IFfpParams[] {
        return this.ffp;
    }

    // 获取匹配规则
    public getFftuwmtr(): IFftuwmtrParams[] {
        return this.fftuwmtr;
    }

    // 删除匹配规则
    public deleteFftuwmtr(index: number) {
        this.fftuwmtr.splice(index, 1);
    }

    // 添加匹配规则
    public addFftuwmtr() {
        this.fftuwmtr.push({
            id: uuidv4(),
            name: ($localize `:@@common.rule:Rule`) + ' ' + (this.fftuwmtr.length + 1),
            conditions: [],
            variations: [],
        })
    }

    // 处理提交数据
    public onSortoutSubmitData() {
        // prerequistes
        this.ffp = this.ffp.map(f => {
          const result = Object.assign({}, f);
          result.valueOptionsVariationValue = f.selectedFeatureFlag?.variationOptions?.find(v => v.localId === result.valueOptionsVariationValue.localId);

          return result;
        });

        this.fftuwmtr = this.fftuwmtr.filter(f => f.conditions.length > 0);

        this.fftuwmtr.forEach((item: IFftuwmtrParams) => {
            item.conditions.forEach((rule: IJsonContent) => {
                if(rule.type === 'multi') {
                    rule.value = JSON.stringify(rule.multipleValue);
                }
                if(rule.type === 'number') {
                    rule.value = rule.value.toString();
                }
            })
        })
    }

    // 获取开关详情
    public getSwicthDetail(): IFfParams {
      return this.ff;
    }

    // *************************** multi states ********************************************
    public getVariationOptions(): IVariationOption[] {
      return this.variationOptions || [];
    }

    public getVariationDataType(): VariationDataTypeEnum {
      return this.variationDataType;
    }

    public getTargetIndividuals(): ITargetIndividualForVariationOption[] {
      return this.targetIndividuals || [];
    }

    public getFFVariationOptionWhenDisabled(): IVariationOption {
      return this.ff.variationOptionWhenDisabled;// || this.variationOptions[0];
    }

    public setFFVariationOptionWhenDisabled(value: IVariationOption) {
        this.ff.variationOptionWhenDisabled = value;
    }

    public getFFDefaultRulePercentageRollouts() : IRulePercentageRollout[]{
      return this.ff.defaultRulePercentageRollouts || [];
    }

    public setFFDefaultRulePercentageRollouts(value: IRulePercentageRollout[]) {
      this.ff.defaultRulePercentageRollouts = Array.from(value);
    }

        // 设置字段信息
    public setConditionConfig(value: IJsonContent[], index: number) {
        this.fftuwmtr[index].conditions = [...value];
    }

    public setRuleValueOptionsVariationRuleValues(value: IRulePercentageRollout[], index: number) {
      this.fftuwmtr[index].variations = Array.from(value);
    }

    public checkMultistatesPercentage(): string[]  {
      const validatonErrs = [];

      // default value
      if (this.ff.defaultRulePercentageRollouts === null || this.ff.defaultRulePercentageRollouts.length === 0) {
        validatonErrs.push('默认返回值不能为空!');
      }

      // variationOptionWhenDisabled
      if (this.ff.variationOptionWhenDisabled === null || this.ff.defaultRulePercentageRollouts.length === 0) {
        validatonErrs.push('开关关闭后的返回值不能为空!');
      }

      const defaultRulePercentage = this.ff.defaultRulePercentageRollouts?.reduce((acc, curr: IRulePercentageRollout) => {
        return acc + (curr.rollout[1] - curr.rollout[0]);
      }, 0);

      if (defaultRulePercentage !== undefined && defaultRulePercentage !== 1) {
        validatonErrs.push('请确认默认返回值的总百分比必须为100%！');
      }

      // fftuwmtr
      this.fftuwmtr.filter(f => f.conditions.length > 0).forEach((item: IFftuwmtrParams) => {
          const percentage = item.variations.reduce((acc, curr: IRulePercentageRollout) => {
              return acc + (curr.rollout[1] - curr.rollout[0]);
          }, 0);

          if (percentage !== 1) {
            validatonErrs.push('请确认匹配条件中每条规则的总百分比必须为100%！');
            return false;
          }
      })

      return validatonErrs;
  }

  // 设置目标用户
  public setTargetIndividuals(data: {[key: string]: IUserType[]}) {
    const targetIndividuals = [];
    for (const property in data) {
      targetIndividuals.push({
        valueOption: this.variationOptions.find(x => x.localId === parseInt(property)),
        individuals: data[property]
      });
    }

    this.targetIndividuals = targetIndividuals;
  }
}
