import { Component, Input } from "@angular/core";
import { ICondition, IRule, RULE_OPS } from "@shared/rules";
import { describeServe } from "@core/components/compare-feature-flag-drawer/utils";
import { isSegmentCondition } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-targeting-rules',
  template: `
    @if (data.flag.rules.length === 0) {
      <span i18n="@@ff.compare.no-targeting-rules">No Targeting Rules</span>
    } @else {
      @for (rule of data.flag.rules; track rule.id) {
        <div class="targeting-rule-entry">
          @for (condition of rule.conditions; track condition.id; let condIdx = $index) {
            @if (condIdx === 0) {
              <span i18n="@@common.if">IF</span> {{ describeCondition(condition) }}
            } @else {
              <br/>
              <span i18n="@@common.and">AND</span> {{ describeCondition(condition) }}
            }
          }
          <br/>
          <span i18n="@@common.serve">SERVE</span> {{ getServe(rule) }}
        </div>
      }
    }
  `,
  styles: `
    .targeting-rule-entry {
      margin-bottom: 8px;
      padding: 8px;
      background-color: #fafafa;
      border-left: 3px solid #1890ff;

      &:last-child {
        margin-bottom: 0;
      }
    }
  `
})
export class RenderTargetRules {
  @Input()
  data: { flag: IFeatureFlag, relatedSegments: { key: string, value: string }[] }

  describeCondition(condition: ICondition): string {
    const relatedSegments = this.data.relatedSegments;

    if (isSegmentCondition(condition.property)) {
      const segmentIds = JSON.parse(condition.value) as string[];
      const segmentNames = relatedSegments
        .filter(seg => segmentIds.includes(seg.key))
        .map(seg => seg.value);
      return `${condition.property} ${segmentNames.join(', ')}`;
    }

    const { property, op, value } = condition;
    const opLabel = RULE_OPS.find(x => x.value === op)?.label || op;

    return `${property} ${opLabel} ${value}`;
  }

  getServe(rule: IRule): string {
    const flag = this.data.flag;

    return describeServe({
      variations: rule.variations!,
      dispatchKey: rule.dispatchKey
    }, flag.variations)
  }
}
