import {Differ} from "@utils/diff/differ";
import {IHtmlChanges, IOptions, IReadableChange, ITranslationConfig} from "@utils/diff/types";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {ICondition, IRule, IVariation} from "@shared/rules";
import {deepCopy, getPercentageFromRolloutPercentageArray, isSegmentCondition, isSingleOperator} from "@utils/index";
import {getTypeOfObj, isKeyPathExactMatchPattern} from "@utils/diff/utils";
import {ruleOps} from "@core/components/find-rule/ruleConfig";
import {ObjectType, Operation} from "ffc-json-diff";
import {IUserType} from "@shared/types";
import {ISegment} from "@features/safe/segments/types/segments-index";

interface IFlatVariationUsers {
  variation: string,
  users: IUserType[]
}

interface IFlatFallthrough {
  includedInExpt: boolean
  variations: IFlatRuleVariation[],
}

interface IFlatFeatureFlag {
  targetUsers: IFlatVariationUsers[],
  fallthrough: IFlatFallthrough,
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

const isMultiValueOperation = (op: string): boolean => {
  switch (op) {
    case 'IsOneOf':
    case 'NotOneOf':
      return true;
  }

  return false;
}

interface refType {
  targetingUsers: IUserType[],
  segments: ISegment[]
}

const normalize = (featureFlag: IFeatureFlag, ref: refType): IFlatFeatureFlag => {
  const flatFeatureFlag: IFlatFeatureFlag = deepCopy(featureFlag);

  flatFeatureFlag.targetUsers = featureFlag.targetUsers.map((t) => ({
    variation: featureFlag.variations.find((v) => v.id === t.variationId)?.value,
    users: ref.targetingUsers.filter((u) => t.keyIds.includes(u.keyId))
      .map((u) => ({...u, name: u.name?.length > 0 ? `${u.name} (${u.keyId})`: u.keyId}))
  }));

  flatFeatureFlag.fallthrough = {
    includedInExpt: featureFlag.fallthrough.includedInExpt,
    variations: featureFlag.fallthrough.variations.map((ruleVariation) => {
      const variation = featureFlag.variations.find((v) => v.id === ruleVariation.id);

      return {
        percentage: `${getPercentageFromRolloutPercentageArray(ruleVariation.rollout)}`,
        exptRollout: ruleVariation.exptRollout,
        variation: variation,
        variationValue: variation.value
      }})
  }

  flatFeatureFlag.rules = featureFlag.rules.map((rule) => {
    const newRule = deepCopy(rule);
    newRule.variations = rule.variations.map((ruleVariation) => ({
      percentage: `${getPercentageFromRolloutPercentageArray(ruleVariation.rollout)}`,
      exptRollout: ruleVariation.exptRollout,
      variation: featureFlag.variations.find((v) => v.id === ruleVariation.id)
    }));

    newRule.conditions = rule.conditions.map((condition) => {
      let { op, property, value } = condition;

      if (isSegmentCondition(condition)) {
        const segmentIds = JSON.parse(value);
        value =  segmentIds.map((segmentId) => {
          const segment = ref.segments.find((seg) => seg.id === segmentId);
          return segment || { id: segmentId }
        });
      } else if (isMultiValueOperation(op)) {
        value = JSON.parse(value)
      }

      return {
        op,
        property,
        type: ruleOps.find(r => r.value === op)?.type,
        value
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
  'targetUsers': 'variation',
  'targetUsers.users': 'keyId',

  'fallthrough.variations': 'variationValue',

  'rules': 'id',
  'rules.variations': 'id',
  'rules.conditions': 'id',
}

const ignoredKeyPaths = [
  ['rules', '*', 'rule'],
  ['rules', '*', 'conditions', '*', 'rule'],
  ['rules', '*', 'variations', '*', 'rule']
]

const translationConfigs = [
  {
    order: 1,
    keyPathPatterns: [['fallthrough', 'variations', '*'], ['fallthrough', 'variations', '*', 'percentage']],
    getContentFunc: function (ops: IReadableChange[]) { // do not use arrow function because we need this
      const op = ops.filter(op => op.change.type !== Operation.REMOVE).map((op: any) => {
        const key = op.keyPath[2];
        const value = getTypeOfObj(op.change.value) === "Object" ? op.change.value.percentage : op.change.value;
        return `${key} (${value}%)`;
      })

      return generateHtmlFromReadableOp({
        title: $localize `:@@ff.diff.default-rule:Default rule`,
        changes: [`<div class="serve-values">${$localize `:@@common.diff.set:Set`} <div class="serve-value">${op.join('</div><div class="serve-value">')}</div></div>`]
      });
    }
  },
  {
    order: 2,
    keyPathPatterns: [
      ["targetUsers", "*", "users","*"],
      ['targetUsers', '*', 'users', '*', 'name']],
    getContentFunc: function (ops: IReadableChange[]) { // do not use arrow function because we need this
      const contentArr = ops.map((op: IReadableChange) => {
        let key: string;
        switch (op.change.type) {
          case Operation.ADD:
            key = op.keyPath[1];
            return `${$localize `:@@common.diff.to:To`} ${key} ${$localize `:@@common.diff.add:Add`} ${op.change.value.name}`;
          case Operation.REMOVE:
            key = op.keyPath[1];
            return `${$localize `:@@common.diff.from:From`} ${key} ${$localize `:@@common.diff.remove:Remove`} ${op.change.value.name}`;
          case Operation.UPDATE:
            key = op.keyPath[1];
            return `${key} ${$localize `:@@common.diff.in:In`} ${$localize `:@@common.diff.rename:Rename`} ${op.change.oldValue} ${$localize `:@@common.diff.as:As`} ${op.change.value}`;
          default:
            return null;
        }
      }).filter(c => c!== null);

      return generateHtmlFromReadableOp({
        title: $localize `:@@ff.diff.targeting-users:Targeting users`,
        changes: contentArr.map((c) => `<div class="ffc-diff-content-item ffc-diff-content-item-individual">${c}</div>`)
      });
    }
  },
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
    }
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
    conditions.map((condition) => {
      let contentStr = '';

      const isSegment = isSegmentCondition(condition as ICondition);
      if (isSegment) {
        contentStr = '<span class="ant-tag">' + (condition.value as any as ISegment[]).map((segment) => segment.name || segment.id).join('</span><span class="ant-tag">') + '</span>';
      } else if (!isSingleOperator(condition.type!)) {
        const conditionType: string = isSegment ? 'multi': ruleOps.filter((rule) => rule.value === condition.op)[0].type;

        if (conditionType === "multi") {
          contentStr = '<span class="ant-tag">' + (condition.value as string[]).join('</span><span class="ant-tag">') + '</span>';
        } else {
          contentStr = condition.value as string;
        }
      } else {
        contentStr = condition.value as string;
      }

      const valueStr = '<div class="value-item">#CONTENT</div>'.replace('#CONTENT', contentStr);

      let clauseStr = `<div class="condition-keyword">${$localize `:@@common.diff.if:If`}</div>`;

      if (isSegment) {
        clauseStr += `${condition.property} ${valueStr}`;
      } else if (condition.type === 'boolean') {
        clauseStr += `${condition.property} ${condition.op}`;
      } else {
        clauseStr += `${condition.property} ${condition.op} ${valueStr}`;
      }

      return clauseStr;
    }).join(`</div><div class="condition-keyword">${$localize `:@@common.diff.and:And`}</div><div class="diff-rule-clause">`) +
    '</div>';

  return `<div class="diff-rule-clauses">${clausesStr}</div><div class="diff-rule-serve"><div class="condition-keyword">${$localize `:@@common.diff.serve:Serve`}</div><div class="serve-values">${serveStr}</div></div>`;
}

class FeatureFlagDiffer {
  private differ: Differ;
  private ref: { [key: string]: IUserType[] }

  constructor() {
    const options: IOptions = {
      normalizeFunc: normalize,
      deNormalizeFunc: null,
      embededKeys,
      ignoredKeyPaths,
      translationConfigs
    };

    this.differ = new Differ(options);
  }

  generateDiff(ff1: IFeatureFlag, ff2: IFeatureFlag, ref?: ObjectType): [number, string] {
    return this.differ.generateDiff(ff1, ff2, ref);
  }
}

export default new FeatureFlagDiffer();
