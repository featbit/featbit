import {Differ} from "@utils/diff/differ";
import {IHtmlChanges, IOptions, IReadableChange, ITranslationConfig} from "@utils/diff/types";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {IRule, IVariation} from "@shared/rules";
import {deepCopy, isSingleOperator} from "@utils/index";
import {convertIntervalToPercentage, isKeyPathExactMatchPattern} from "@utils/diff/utils";
import {ruleOps} from "@core/components/find-rule/ruleConfig";
import {Operation} from "ffc-json-diff";

interface IFlatFeatureFlag {
  rules: IFlatRule[]
}

interface IFlatRuleCondition {
  id?: string,
  rule?: IRule, // for reference only
  op: string | null,
  property: string,
  value: string | string[],
  type?: string
}

interface IFlatRuleVariation {
  id?: string,
  rule?: IRule, // for reference only
  exptRollout: null | number,
  percentage: string,
  variation: IVariation
}

interface IFlatRule {
  includedInExpt: boolean | null,
  id: string,
  name: string,
  rule?: IRule, // for reference only
  conditions: IFlatRuleCondition[],
  variations: IFlatRuleVariation[]
}

const isSegmentClause = (property: string): boolean => {
  return ['User is in segment', 'User is not in segment'].includes(property);
}

const isMultiValueOperation = (op: string): boolean => {
  switch (op) {
    case 'IsOneOf':
    case 'NotOneOf':
      return true;
  }

  return false;
}

const getReferenceFunc = (featureFlag: IFeatureFlag): IFlatRule[] => {
  return featureFlag.rules.map((rule) => {
    const newRule = deepCopy(rule);
    newRule.variations = rule.variations.map((ruleVariation) => ({
      percentage: `${convertIntervalToPercentage(ruleVariation.rollout)}`,
      exptRollout: ruleVariation.exptRollout,
      variation: featureFlag.variations.find((v) => v.id === ruleVariation.id)
    }));

    newRule.conditions = rule.conditions.map(r => {
      const { op, property, value } = r;
      return {
        op,
        property,
        type: ruleOps.find(r => r.value === op)?.type,
        value: isSegmentClause(property) || isMultiValueOperation(op) ? JSON.parse(value) : value
      }
    });

    return newRule;
  });
}

const normalizeFunc = (featureFlag: IFeatureFlag): IFlatFeatureFlag => {
  const flatFeatureFlag: IFlatFeatureFlag = deepCopy(featureFlag);

  flatFeatureFlag.rules = featureFlag.rules.map((rule) => {
    const newRule = deepCopy(rule);
    newRule.variations = rule.variations.map((ruleVariation) => ({
      percentage: `${convertIntervalToPercentage(ruleVariation.rollout)}`,
      exptRollout: ruleVariation.exptRollout,
      variation: featureFlag.variations.find((v) => v.id === ruleVariation.id)
    }));

    newRule.conditions = rule.conditions.map(r => {
      const { op, property, value } = r;
      return {
        op,
        property,
        type: ruleOps.find(r => r.value === op)?.type,
        value: isSegmentClause(property) || isMultiValueOperation(op) ? JSON.parse(value) : value
      }
    });

    const { includedInExpt, id, name } = rule;
    const flatRule: IFlatRule = { includedInExpt, id, name, rule: newRule } as IFlatRule;

    flatRule.conditions = [rule.conditions.reduce((acc, cur) => {
      const { op, property, value } = cur;
      acc['id'] += `${property}_${op || ''}_${value}`;
      acc.rule = newRule;

      return acc;
    }, {id: `${flatRule.id}#`} as IFlatRuleCondition)];

    flatRule.variations = [rule.variations.reduce((acc, cur) => {
      acc.id += `${cur.exptRollout}_${cur.percentage}_${cur.id}`;
      acc.rule = newRule;

      return acc;
    }, {id: `${flatRule.id}#`} as IFlatRuleVariation)];

    return flatRule;
  })

  delete flatFeatureFlag['originalData'];

  return flatFeatureFlag;
}

const embededKeys = {
  'rules': 'id',
  'rules.variations': 'id',
  'rules.conditions': 'id',
  /**** above is for normalized properties ****/
}

const ignoredKeyPaths = [
  ['rules', '*', 'rule'],
  ['rules', '*', 'conditions', '*', 'rule'],
  ['rules', '*', 'variations', '*', 'rule']
]

const translationConfigs = [
  {
    order: 3,
    keyPathPatterns: [
      ['rules', '*'],
      ['rules', '*', 'conditions', '*'],
      ['rules', '*', 'variations', '*']
    ],
    getContentFunc: function (this: ITranslationConfig, ops: IReadableChange[]) { // do not use arrow function because we need this
      const ruleAddOrRemove = ops.filter(op => isKeyPathExactMatchPattern(op.keyPath, [this.keyPathPatterns[0]])).map((op: IReadableChange) => {
        const rule = op.change.value.rule;
        switch (op.change.type) {
          case Operation.ADD:
            return `<div class="diff-content-item diff-content-item-rule">
                          <div class="diff-rule-name">${$localize `:@@common.diff.add-rule:Add rule`} ${rule.name}</div>
                          <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
                      </div>`;
          case Operation.REMOVE:
            return `<div class="diff-content-item diff-content-item-rule">
                          <div class="diff-rule-name">${$localize `:@@common.diff.remove-rule:Remove rule`} ${rule.name}</div>
                          <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
                      </div>`;
          default:
            return null;
        }

      }).filter(c => c!== null);

      const ruleUpdateDict = ops.filter(op => isKeyPathExactMatchPattern(op.keyPath, [this.keyPathPatterns[1], this.keyPathPatterns[2]]))
        .filter(op => op.change.type === Operation.ADD)
        .reduce((acc, cur) => {
          (acc[cur.keyPath[1]] = acc[cur.keyPath[1]] || []).push(cur);
          return acc;
        }, {});

      const ruleUpdate = Object.keys(ruleUpdateDict).map(ruleId => {
        const op = ruleUpdateDict[ruleId][0];
        const rule = op.change.value.rule;
        return `<div class="diff-content-item diff-content-item-rule">
                  <div class="diff-rule-name">${$localize `:@@common.diff.update-rule:Update rule`} ${rule.name}</div>
                  <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
              </div>`;
      });

      return generateHtmlFromReadableOp({
        title: $localize `:@@ff.diff.rules:Rules`,
        changes: [...ruleAddOrRemove, ...ruleUpdate]
      });
    },
    code: 'RULES'
  }
]

interface IReadableOp {
  title: string,
  changes: string[]
}

const generateHtmlFromReadableOp = (op: IReadableOp): IHtmlChanges => {
  return {
    count: op.changes.length,
    html: `<div class="diff-container"><div class="diff-title">${op.title}</div><div class="diff-content">${op.changes.join('')}</div></div>`
  };
}

const generateRuleHtmlDescription = (conditions: IFlatRuleCondition[], variations: IFlatRuleVariation[]): string => {
  const serveStr = `<div class="serve-value">${variations.map(v => `${v.variation.value} (${v.percentage}%)`).join('</div><div class="serve-value">')}</div>`;

  const clausesStr = '<div class="diff-rule-clause">' +
    conditions.map(clause => {
      const clauseType: string = isSegmentClause(clause.property) ? 'multi': ruleOps.filter((rule) => rule.value === clause.op)[0].type;
      const valueStr = !isSingleOperator(clause.type!) ? `<div class="value-item">${clauseType === "multi" ? (clause.value as string[]).join('</span><span class="ant-tag">') : clause.value}</div>` : clause.value;

      return `<div class="condition-keyword">${$localize `:@@common.diff.if:If`}</div> ${clause.property} ${clause.op} ${valueStr}`;
    }).join(`</div><div class="condition-keyword">${$localize `:@@common.diff.and:And`}</div><div class="diff-rule-clause">`) +
    '</div>';

  return `<div class="diff-rule-clauses">${clausesStr}</div><div class="diff-rule-serve"><div class="condition-keyword">${$localize `:@@common.diff.serve:Serve`}</div><div class="serve-values">${serveStr}</div></div>`;
}

class FeatureFlagDiffer {
  private differ: Differ;

  constructor() {
    const options: IOptions = {
      normalizeFunc,
      deNormalizeFunc: null,
      embededKeys,
      ignoredKeyPaths,
      translationConfigs
    };

    this.differ = new Differ(options);
  }

  generateDiff(ff1: IFeatureFlag, ff2: IFeatureFlag): [number, string] {
    return this.differ.generateDiff(ff1, ff2);
  }
}

export default new FeatureFlagDiffer();
