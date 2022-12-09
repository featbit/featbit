import {Differ} from "@utils/diff/differ";
import {IHtmlChanges, IOptions, IReadableChange, ITranslationConfig} from "@utils/diff/types";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";
import {ICondition, IRule, IVariation} from "@shared/rules";
import {deepCopy, getPercentageFromRolloutPercentageArray, isSegmentCondition, isSingleOperator} from "@utils/index";
import {isKeyPathExactMatchPattern} from "@utils/diff/utils";
import {ruleOps} from "@core/components/find-rule/ruleConfig";
import {ObjectType, Operation} from "ffc-json-diff";
import {IUserType} from "@shared/types";
import {ISegment} from "@features/safe/segments/types/segments-index";

interface IFlatVariationUsers {
  variation: string,
  users: string[]
}

interface IFlatFallthrough {
  includedInExpt: boolean
  variations: string // json string of variations
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
  variation?: IVariation
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

  flatFeatureFlag.targetUsers = featureFlag.variations.map((variation) => {
    const variationTargetUsers = featureFlag.targetUsers.find((tu) => tu.variationId === variation.id);
    return {
      variation: variation.value,
      users: variationTargetUsers === undefined ? [] : variationTargetUsers.keyIds.map((keyId) => {
        const user = ref.targetingUsers.find((user) => user.keyId === keyId);
        if (!user) {
          return keyId;
        }

        return user.name?.length > 0
          ? `${user.name} (${user.keyId})`
          : user.keyId;
      })
    }
  });

  flatFeatureFlag.fallthrough = {
    includedInExpt: featureFlag.fallthrough.includedInExpt,
    variations: JSON.stringify(featureFlag.fallthrough.variations.map((ruleVariation) => {
      const variation = featureFlag.variations.find((v) => v.id === ruleVariation.id);

      return {
        percentage: `${getPercentageFromRolloutPercentageArray(ruleVariation.rollout)}`,
        value: variation.value
      }}))
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
    keyPathPatterns: [['fallthrough', 'variations']],
    getContentFunc: function (ops: IReadableChange[]) { // do not use arrow function because we need this
      const updateOp = ops.find(op => op.change.type === Operation.UPDATE);

      if (updateOp && updateOp.change?.value?.length > 0) {
        const variations = JSON.parse(updateOp.change.value).map((variation) => `${variation.value} (${variation.percentage}%)`)
        return generateHtmlFromReadableOp({
          title: $localize `:@@ff.diff.default-rule:Default rule`,
          changes: [`<li><span class="operation ant-typography ant-typography-success">${$localize `:@@common.diff.set-as:Set as`}</span> <span class="ant-tag">${variations.join('</span><span class="ant-tag">')}</span></li>`]
        });
      }

      return {
        count: 0,
        html: ''
      }
    }
  },
  {
    order: 2,
    keyPathPatterns: [
      ["targetUsers", "*", "users","*"],
    ],
    getContentFunc: function (ops: IReadableChange[]) { // do not use arrow function because we need this
      const contentArr = ops.map((op: IReadableChange) => {
        let key: string;
        switch (op.change.type) {
          case Operation.ADD:
            key = op.keyPath[1];
            return `<span class="operation ant-typography ant-typography-success">${$localize `:@@common.diff.add:Add`}</span> <span class="ant-tag">${op.change.value}</span>${$localize `:@@common.diff.to:To`} <span class="ant-tag">${key}</span>`;
          case Operation.REMOVE:
            key = op.keyPath[1];
            return `<span class="operation ant-typography ant-typography-danger">${$localize `:@@common.diff.remove:Remove`}</span> <span class="ant-tag remove-item">${op.change.value}</span>${$localize `:@@common.diff.from:From`} <span class="ant-tag">${key}</span>`;
          default:
            return null;
        }
      }).filter(c => c!== null);

      return generateHtmlFromReadableOp({
        title: $localize `:@@ff.diff.targeting-users:Targeting users`,
        changes: contentArr.map((c) => `<li class="diff-instruction diff-instruction-targeting-user">${c}</li>`)
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
            return `<li class="diff-instruction diff-instruction-rule">
                          <div class="diff-rule-name"><span class="operation ant-typography ant-typography-success">${$localize `:@@common.diff.add:Add`}</span>: ${rule.name}</div>
                          <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
                      </li>`;
          case Operation.REMOVE:
            return `<li class="diff-instruction diff-instruction-rule">
                          <div class="diff-rule-name"><span class="operation ant-typography ant-typography-danger">${$localize `:@@common.diff.remove-rule:Remove`}</span>: ${rule.name}</div>
                          <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
                      </li>`;
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
        return `<li class="diff-instruction diff-instruction-rule">
                  <div class="diff-rule-name"><span class="operation ant-typography ant-typography-success">${$localize `:@@common.diff.update:Update`}</span>: ${rule.name}</div>
                  <div class="diff-rule-description">${generateRuleHtmlDescription(rule.conditions, rule.variations)}</div>
              </li>`;
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
    html: `<div class="diff-category"><div class="diff-category-title">${op.title}</div><ul class="diff-category-instructions">${op.changes.join('')}</ul></div>`
  };
}

const generateRuleHtmlDescription = (conditions: IFlatRuleCondition[], variations: IFlatRuleVariation[]): string => {
  const serveStr = `<span class="ant-tag">${variations.map(v => `${v.variation.value} (${v.percentage}%)`).join('</span><span class="ant-tag">')}</span>`;

  const clausesStr = '<div class="diff-rule-condition">' +
    conditions.map((condition) => {
      let contentStr: string;

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
        clauseStr += `<span>${condition.property}</span> <span>${valueStr}</span>`;
      } else if (condition.type === 'boolean') {
        clauseStr += `<span>${condition.property}</span> <span>${condition.op}</span>`;
      } else {
        clauseStr += `<span>${condition.property}</span> <span>${condition.op}</span> <span>${valueStr}</span>`;
      }

      return clauseStr;
    }).join(`</div><div class="condition-keyword">${$localize `:@@common.diff.and:And`}</div><div class="diff-rule-condition">`) +
    '</div>';

  return `<div class="diff-rule-clauses">${clausesStr}</div><div class="diff-rule-serve"><div class="condition-keyword">${$localize `:@@common.diff.serve:Serve`}</div><div class="serve-values">${serveStr}</div></div>`;
}

class FeatureFlagDiffer {
  private differ: Differ;

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
