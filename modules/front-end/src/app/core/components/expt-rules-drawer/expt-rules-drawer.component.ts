import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ISegment } from '@features/safe/segments/types/segments-index';
import { ruleOps, IRuleOp } from "@core/components/find-rule/ruleConfig";
import { IRulePercentageRollout } from '@features/safe/feature-flags/types/switch-new';
import { SegmentService } from '@services/segment.service';
import { isSegmentRule, isSingleOperator } from '@utils/index';
import {FeatureFlag, IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IRuleVariation, isNotPercentageRollout} from "@shared/rules";
import {FeatureFlagService} from "@services/feature-flag.service";
import {IUserType} from "@shared/types";

@Component({
  selector: 'app-expt-rules-drawer',
  templateUrl: './expt-rules-drawer.component.html',
  styleUrls: ['./expt-rules-drawer.component.less']
})
export class ExptRulesDrawerComponent {

  @Input() currentAccountId: number;
  @Input() visible: boolean = false;
  @Input() targetingUsersByVariation: { [key: string]: IUserType[] } = {};
  @Output() close: EventEmitter<any> = new EventEmitter();

  selectedSegmentDetailsDict: {[key: string]: ISegment[]} = {};

  private _ff: IFeatureFlag = null;

  experimentRolloutType: 'default' | 'recommended' = 'default';

  includeAllRules = true;

  customRules = false;

  get featureFlag() {
    return this._ff;
  }

  @Input()
  set featureFlag(ff: IFeatureFlag) {
    if (ff && Object.keys(ff).length > 0) {
      let segmentIds = [];
      const data = Object.assign({}, ff, {
        rules: ff.rules.map(rule => {
          const result = {
            conditions: rule.conditions.map(condition => {
              const isSegment = isSegmentRule(condition);
              let ruleType: string = isSegment ? 'multi': ruleOps.filter((rule: IRuleOp) => rule.value === condition.op)[0].type;

              let multipleValue: string[] = [];

              if(ruleType === 'multi' && condition.multipleValue === undefined) {
                multipleValue = JSON.parse(condition.value || '[]');
                if (isSegment) {
                  segmentIds = [...segmentIds, ...multipleValue];
                }
              }

              return Object.assign({ multipleValue: multipleValue, type: ruleType, isSingleOperator: isSingleOperator(ruleType), isSegment}, condition);
            }),
            includedInExpt: !!rule.includedInExpt,
            isNotPercentageRollout: isNotPercentageRollout(rule.variations),
            variations: rule.variations.map(variation => Object.assign({}, variation, {
              percentage: (parseFloat((variation.rollout[1] - variation.rollout[0]).toFixed(2))) * 100
            }))
          };

          this.initExperimentRollout(result.variations);
          return Object.assign({}, rule, result);
        }),
        fallthrough: {
          ...(ff.fallthrough || {}),
          includedInExpt: !!ff.fallthrough?.includedInExpt,
          isNotPercentageRollout: isNotPercentageRollout(ff.fallthrough.variations),
          variations: ff.fallthrough.variations.map(item => Object.assign({}, item, {
            percentage: (parseFloat((item.rollout[1] - item.rollout[0]).toFixed(2))) * 100
          }))
        }
      });

      if (segmentIds.length > 0) {
        this.segmentService.getByIds(segmentIds.flat()).subscribe((segs: ISegment[]) => {
          this.selectedSegmentDetailsDict = segs.reduce((acc, curr) => {
            acc[curr.id] = acc[curr.id] || curr;
            return acc;
          }, {});
        });
      }

      this.initExperimentRollout(data.fallthrough.variations);
      this._ff = new FeatureFlag(data);
    }
  }

  private initExperimentRollout(variations: IRuleVariation[]) {
    const self = this;
    variations.forEach(variation => {
      if (!variation.exptRollout) {
        self.setDefaultExperimentRollout(variation);
      }
      else {
        variation.exptPercentage = variation.exptRollout * 100;
      }
    });
  }

  // 使用默认的实验分流比例
  useDefaultExperimentRollout() {
    // 条件规则
    this.featureFlag.rules.forEach(rule =>
      rule.variations.forEach(variation => {
        this.setDefaultExperimentRollout(variation);
      })
    );

    // 默认值
    this.featureFlag.fallthrough.variations.forEach(rule => {
      this.setDefaultExperimentRollout(rule);
    });

    this.experimentRolloutType = 'default';
  }

  // 选择要使用的实验分流比例类型
  toggleExperimentRolloutType() {
    this.experimentRolloutType === 'default' ?
      this.useRecommendedExperimentRollout() :
      this.useDefaultExperimentRollout();
  }

  // 使用推荐的实验分流比例
  useRecommendedExperimentRollout() {
    // 条件规则
    this.featureFlag.rules.forEach(rule =>
      this.setRecommendedExperimentRollout(rule.variations, rule.isNotPercentageRollout)
    );

    // 默认值
    this.setRecommendedExperimentRollout(this.featureFlag.fallthrough.variations, this.featureFlag.fallthrough.isNotPercentageRollout);

    this.experimentRolloutType = 'recommended';
  }

  // 使用默认的实验分流比例 (保持和请求分流比例一致)
  private setDefaultExperimentRollout(variation: IRuleVariation) {
    variation.exptPercentage = variation.percentage;
    variation.exptRollout = variation.percentage / 100;
  }

  // 根据请求分流比例计算最合适的实验分流比例
  private setRecommendedExperimentRollout(rules: IRuleVariation[], isNotPercentageRollout: boolean) {
    if (isNotPercentageRollout) {
      rules.forEach(rule => {
        rule.exptPercentage = rule.percentage;
        rule.exptRollout = rule.percentage / 100;
      });
      return;
    }

    const has100Percentage = rules.find(rule => rule.percentage == 100);
    if (has100Percentage) {
      rules.forEach(rule => {
        rule.exptPercentage = 0;
        rule.exptRollout = 0;
      });
      return;
    }

    const minPercentage = Math.min(...rules.map(r => r.percentage)) || 0;
    rules.forEach(rule => {
      rule.exptPercentage = minPercentage;
      rule.exptRollout = minPercentage / 100;
    });
  }

  exptPercentageChange(ruleValue: IRuleVariation) {
    if (ruleValue) {
      ruleValue.exptRollout = ruleValue.exptPercentage / 100;
    }
  }

  constructor(
    private featureFlagService: FeatureFlagService,
    private segmentService: SegmentService,
    private message: NzMessageService
  ) {
  }

  onClose() {
    this.close.emit({ isSaved: false, data: this.featureFlag });
  }

  doSubmit() {
    const { id, targetUsers, rules, fallthrough, exptIncludeAllTargets } = this.featureFlag;

    this.featureFlagService.update({ id, targetUsers, rules, fallthrough, exptIncludeAllTargets })
      .subscribe((result) => {
        this.message.success("保存成功!");
        this.close.emit({ isSaved: true, data: this.featureFlag });
      }, _ => {
        this.message.error("保存失败!");
        this.close.emit({ isSaved: false, data: this.featureFlag });
      })
  }

  getVariationValue(id: string): string{
    return this.featureFlag.variations.find(v => v.id === id).value;
  }
}
