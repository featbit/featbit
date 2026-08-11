import { Component, Input } from "@angular/core";
import { ICondition, IRule, RULE_OPS } from "@shared/rules";
import { describeServe } from "@core/components/compare-feature-flag-drawer/utils";
import { isSegmentCondition } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-targeting-rules',
  template: `
    @if (data.flag.rules.length === 0) {
      <span class="empty-state-text" i18n="@@ff.compare.no-targeting-rules">No Targeting Rules</span>
    } @else {
      @for (rule of data.flag.rules; track rule.id) {
        <div class="targeting-rule-entry">
          <div class="rule-name">{{ rule.name }}</div>
          <div class="conditions-section">
            @for (condition of rule.conditions; track condition.id; let condIdx = $index) {
              <div class="condition-row">
              <span class="condition-keyword" [class.if-keyword]="condIdx === 0" [class.and-keyword]="condIdx > 0">
                @if (condIdx === 0) {
                  <span i18n="@@common.if">IF</span>
                } @else {
                  <span i18n="@@common.and">AND</span>
                }
              </span>
                <span class="condition-content">{{ describeCondition(condition) }}</span>
              </div>
            }
          </div>
          <div class="serve-section">
            <span class="serve-keyword" i18n="@@common.serve">SERVE</span>
            <span class="serve-content">{{ getServe(rule) }}</span>
          </div>
        </div>
      }
    }
  `,
  styles: `
    .empty-state-text {
      color: #8c8c8c;
      font-style: italic;
    }

    .targeting-rule-entry {
      margin-bottom: 8px;
      padding: 8px;
      background-color: #fafafa;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .rule-name {
      font-size: 11px;
      font-weight: 600;
      color: #8c8c8c;
      text-transform: uppercase;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    .conditions-section {
      margin-bottom: 8px;
    }

    .condition-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .condition-keyword {
      display: inline-block;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 3px;
      flex-shrink: 0;

      &.if-keyword {
        background-color: #e6f7ff;
        color: #0050b3;
      }

      &.and-keyword {
        background-color: #f0f5ff;
        color: #2f54eb;
      }
    }

    .condition-content {
      flex: 1;
      color: #262626;
      font-size: 12px;
      line-height: 1.5;
    }

    .serve-section {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e0e0e0;
    }

    .serve-keyword {
      display: inline-block;
      padding: 2px 6px;
      background-color: #f6ffed;
      color: #389e0d;
      font-size: 11px;
      font-weight: 600;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .serve-content {
      flex: 1;
      color: #262626;
      font-size: 12px;
      font-weight: 500;
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
