import { Differ } from "@utils/diff/differ";
import { IOptions, IReadableChange, ITranslationConfig, Translation } from "@utils/diff/types";
import { convertIntervalToPercentage, convertPercentageToInterval, getTypeOfObj, isKeyPathExactMatchPattern } from "@utils/diff/utils";
import { Operation } from "ffc-json-diff";

const normalizeFn = (ff: IFeatureFlag): IFlatFeatureFlag => {
  const result: IFlatFeatureFlag = JSON.parse(JSON.stringify(ff));

  result.targetIndividuals = ff.targetIndividuals.map((t: ITargetIndividual) => ({
      variationId: t.valueOption.variationValue,
      valueOption: t.valueOption,
      individuals: t.individuals
  }));

  result.defaultRulePercentageRollouts = ff.ff.defaultRulePercentageRollouts.map(r => ({
      variationId: r.valueOption.variationValue,
      valueOption: r.valueOption,
      rolloutPercentage: `${convertIntervalToPercentage(r.rolloutPercentage)}`,
      exptRollout: r.exptRollout
  }));

  delete result['ff']['defaultRulePercentageRollouts'];


  result.fftuwmtr = ff.fftuwmtr.map(rule => {
      const { isIncludedInExpt, ruleId, ruleName } = rule;
      const result: IFlatRule = { isIncludedInExpt, ruleId, ruleName } as IFlatRule;

      const _rule = JSON.parse(JSON.stringify(rule));
      _rule.valueOptionsVariationRuleValues = _rule.valueOptionsVariationRuleValues.map(v => ({
          valueOption: v.valueOption,
          rolloutPercentage: `${convertIntervalToPercentage(v.rolloutPercentage)}`,
          exptRollout: v.exptRollout,
      }));

      _rule.ruleJsonContent = _rule.ruleJsonContent.map(r => {
        const { operation, property, value } = r;
        return {
            operation,
            property,
            type: ruleValueConfig.find(r => r.value === operation)?.type,
            value: isSegmentClause(property) || isMultiValueOperation(operation!) ? JSON.parse(value) : value
        }
      });

      result.ruleJsonContent = [rule.ruleJsonContent.reduce((acc, cur) => {
          const { operation, property, value } = cur;
          acc['id'] += `${property}_${operation || ''}_${value}}`;

          acc.rule = _rule;

          acc.items.push({
              operation,
              property,
              type: ruleValueConfig.find(r => r.value === operation)?.type,
              value: isSegmentClause(property) || isMultiValueOperation(operation!) ? JSON.parse(value) : value
          });

          return acc;
      }, {id: '', items: []} as IFlatRuleClausesWrapper)];

      result.valueOptionsVariationRuleValues = [rule.valueOptionsVariationRuleValues.reduce((acc, cur) => {
          acc.id += `${cur.exptRollout}_${cur.rolloutPercentage}_${cur.valueOption.variationValue}`;
          acc.rule = _rule;
          acc.items.push({
              valueOption: cur.valueOption,
              rolloutPercentage: `${convertIntervalToPercentage(cur.rolloutPercentage)}`,
              exptRollout: cur.exptRollout,
          });

          return acc;
      }, {id: '', items: []} as IFlatVariationOptionsWrapper)];

      return result
  });

  return result;
}

const deNormalizeFn = (ff: IFlatFeatureFlag): IFeatureFlag => {
  const result = JSON.parse(JSON.stringify(ff));

  result.targetIndividuals = ff.targetIndividuals.map((t: IFlatTargetIndividual) => ({
      valueOption: t.valueOption,
      individuals: t.individuals
  }));

  result.ff.defaultRulePercentageRollouts = ff.defaultRulePercentageRollouts.map((rule: IFlatRuleValue) => {
      const { exptRollout, rolloutPercentage, valueOption } = rule;
      return {
          exptRollout,
          rolloutPercentage: convertPercentageToInterval(rolloutPercentage),
          valueOption
      };
  });

  delete result['defaultRulePercentageRollouts'];

  result.fftuwmtr = ff.fftuwmtr.map((rule: IFlatRule) => {
      const { isIncludedInExpt, ruleId, ruleName } = rule;
      const result: IRule = { isIncludedInExpt, ruleId, ruleName } as IRule;

      result.ruleJsonContent = rule.ruleJsonContent[0]?.items?.map(clause => {
          const { operation, property, value } = clause;
          return {
              operation,
              property,
              value: isSegmentClause(property) || isMultiValueOperation(operation!) ? JSON.stringify(value) : value as string
          }
      });

      result.valueOptionsVariationRuleValues = rule.valueOptionsVariationRuleValues[0]?.items?.map(r => ({
          valueOption: r.valueOption,
          rolloutPercentage: convertPercentageToInterval(r.rolloutPercentage),
          exptRollout: r.exptRollout
      }));

      return result
  });

  return result;
}

const translation: Translation = {
  'DEFAULT_VARIATION': '默认返回值',
  'TARGET_INDIVIDUALS': '目标用户',
  'ADD': '添加',
  'REMOVE': '移除',
  'SET': '设置为',
  'FROM': '从',
  'TO': '向',
  'RENAME': '重命名',
  'AS': '为',
  'IN': '中',
  'ADD_RULE': '添加规则',
  'REMOVE_RULE': '移除规则',
  'UPDATE_RULE': '更新规则',
  'RULES': '匹配规则',

  'IF': '如果',
  'AND': '并且',
  'SERVE': '返回',
}

const translationConfigs = [
  {
      order: 1,
      keyPathPatterns: [['defaultRulePercentageRollouts', '*'], ['defaultRulePercentageRollouts', '*', 'rolloutPercentage']],
      getContentFunc: function (ops: IReadableChange[], translations: Translation) { // do not use arrow function because we need this
          const op = ops.filter(op => op.change.type !== Operation.REMOVE).map((op: any) => {
              const key = op.keyPath[1];
              const value = getTypeOfObj(op.change.value) === "Object" ? op.change.value.rolloutPercentage : op.change.value;
              return `${key} (${value}%)`;
          })

          const opCode = 'SET';

          return generateHtmlFromReadableOp({
              title: translations[this.code],
              content: `<div class="serve-values">${translations[opCode]} <div class="serve-value">${op.join('</div><div class="serve-value">')}</div></div>`
          });
      },
      code: 'DEFAULT_VARIATION'
  },
  {
      order: 2,
      keyPathPatterns: [
          ["targetIndividuals", "*", "individuals","*"],
          ['targetIndividuals', '*', 'individuals', '*', 'name']],
      getContentFunc: function (ops: IReadableChange[], translations: Translation) { // do not use arrow function because we need this

          const contentArr = ops.map((op: IReadableChange) => {
              let key: string;
              switch (op.change.type) {
                  case Operation.ADD:
                      key = op.keyPath[1];
                      return `${translations['TO']} ${key} ${translations['ADD']} ${op.change.value.name}`;
                  case Operation.REMOVE:
                      key = op.keyPath[1];
                      return `${translations['FROM']} ${key} ${translations['REMOVE']} ${op.change.value.name}`;
                  case Operation.UPDATE:
                      key = op.keyPath[1];
                      return `${key} ${translations['IN']} ${translations['RENAME']} ${op.change.oldValue} ${translations['AS']} ${op.change.value}`;
                  default:
                      return null;
              }
          }).filter(c => c!== null);

          return generateHtmlFromReadableOp({
              title: translations[this.code],
              content: contentArr.map((c) => `<div class="ffc-diff-content-item ffc-diff-content-item-individual">${c}</div>`).join('')
          });
      },
      code: 'TARGET_INDIVIDUALS'
  },
  {
      order: 3,
      keyPathPatterns: [
          ['fftuwmtr', '*'],
          ['fftuwmtr', '*', 'ruleJsonContent', '*'],
          ['fftuwmtr', '*', 'valueOptionsVariationRuleValues', '*']
      ],
      getContentFunc: function (this: ITranslationConfig, ops: IReadableChange[], translations: Translation) { // do not use arrow function because we need this

          const ruleAddOrRemove = ops.filter(op => isKeyPathExactMatchPattern(op.keyPath, [this.keyPathPatterns[0]])).map((op: IReadableChange) => {
              const rule = op.change.value;
              switch (op.change.type) {
                  case Operation.ADD:
                      return `<div class="ffc-diff-content-item ffc-diff-content-item-rule">
                          <div class="ffc-diff-rule-name">${translations['ADD_RULE']} ${rule.ruleName}</div>
                          <div class="ffc-diff-rule-description">${generateRuleDescription(rule.ruleJsonContent[0].items, rule.valueOptionsVariationRuleValues[0].items, translations)}</div>
                      </div>`;
                  case Operation.REMOVE:
                      return `<div class="ffc-diff-content-item ffc-diff-content-item-rule">
                          <div class="ffc-diff-rule-name">${translations['REMOVE_RULE']} ${op.change.value.ruleName}</div>
                          <div class="ffc-diff-rule-description">${generateRuleDescription(rule.ruleJsonContent[0].items, rule.valueOptionsVariationRuleValues[0].items, translations)}</div>
                      </div>`;
                  default:
                      return null;
              }

          }).filter(c => c!== null);

          const ruleUpateDict = ops.filter(op => isKeyPathExactMatchPattern(op.keyPath, [this.keyPathPatterns[1], this.keyPathPatterns[2]]))
                               .filter(op => op.change.type === Operation.ADD).map(op => op)
                               .reduce((acc, cur) => {
                                  (acc[cur.keyPath[1]] = acc[cur.keyPath[1]] || []).push(cur);
                                  return acc;
                              }, {});

          const ruleUpate = Object.keys(ruleUpateDict).map(ruleId => {
              const op = ruleUpateDict[ruleId][0];
              const rule = op.change.value.rule;
              return `<div class="ffc-diff-content-item ffc-diff-content-item-rule">
                  <div class="ffc-diff-rule-name">${translations['UPDATE_RULE']} ${rule.ruleName}</div>
                  <div class="ffc-diff-rule-description">${generateRuleDescription(rule.ruleJsonContent, rule.valueOptionsVariationRuleValues, translations)}</div>
              </div>`;
          });

          return generateHtmlFromReadableOp({
              title: translations[this.code],
              content: [...ruleAddOrRemove, ...ruleUpate].join('')
          });
      },
      code: 'RULES'
  }
]

const embededKeys = {
  'targetIndividuals': 'variationId',
  'targetIndividuals.individuals': 'id',
  'defaultRulePercentageRollouts': 'variationId',
  'fftuwmtr': 'ruleId',
  'fftuwmtr.valueOptionsVariationRuleValues': 'id',
  'fftuwmtr.ruleJsonContent': 'id',
  /**** above is for normalized properties ****/
  'variationOptions': 'localId',
}

const ignoredKeyPaths = [
  ['ff', 'lastUpdatedTime'],
  ['fftuwmtr', '*', 'ruleJsonContent', '*', 'rule'],
  ['fftuwmtr', '*', 'valueOptionsVariationRuleValues', '*', 'rule']
]

class FeatureFlagDiffer {
  private differ: Differ

  constructor() {
    const options: IOptions = {
      normalizeFn,
      deNormalizeFn,
      embededKeys,
      ignoredKeyPaths,
      translationConfigs,
      translation,
    };

    this.differ = new Differ(options);
  }

  generateDiff(ff1: any, ff2: any): [number, string] {
    return this.differ.generateDiff(ff1, ff2);
  }
}

export default new FeatureFlagDiffer();

interface IFlatRuleClause {
  operation: string | null,
  property: string,
  value: string | string[],
  type?: string
}

interface IFlatRuleValue {
  exptRollout: null | number,
  rolloutPercentage: string,
  valueOption: IValueOption
}

interface IValueOption {
  localId: number | string,
  variationValue: string
}

const isSegmentClause = (property: string): boolean => {
  return ['User is in segment', 'User is not in segment'].includes(property);
}

const isSingleOperator = (operationType: string): boolean => {
  return !['string', 'number', 'regex', 'multi'].includes(operationType);
}

const generateHtmlFromReadableOp = (op: IReadableOp): string => {
  return `<div class="ffc-diff"><div class="ffc-diff-title">${op.title}</div><div class="ffc-diff-content">${op.content}</div></div>`;
}

const generateRuleDescription = (ruleJsonContent: IFlatRuleClause[], valueOptionsVariationRuleValues: IFlatRuleValue[], translations: Translation): string => {
  const serveStr = `<div class="serve-value">${valueOptionsVariationRuleValues.map(v => `${v.valueOption.variationValue} (${v.rolloutPercentage}%)`).join('</div><div class="serve-value">')}</div>`;

  const clausesStr = '<div class="ffc-diff-rule-clause">' +
                      ruleJsonContent.map(clause => {
                          const clauseType: string = isSegmentClause(clause.property) ? 'multi': ruleValueConfig.filter((rule) => rule.value === clause.operation)[0].type;
                          const valueStr = !isSingleOperator(clause.type!) ? `<div class="value-item">${clauseType === "multi" ? (clause.value as string[]).join('</span><span class="ant-tag">') : clause.value}</div>` : clause.value;

                          return `<div class="condition-keyword">${translations['IF']}</div> ${clause.property} ${clause.operation} ${valueStr}`;
                       }).join(`</div><div class="condition-keyword">${translations['AND']}</div><div class="ffc-diff-rule-clause">`) +
                      '</div>';

  return `<div class="ffc-diff-rule-clauses">${clausesStr}</div><div class="ffc-diff-rule-serve"><div class="condition-keyword">${translations['SERVE']}</div><div class="serve-values">${serveStr}</div></div>`;
}

const isMultiValueOperation = (op: string): boolean => {
  switch (op) {
      case 'IsOneOf':
      case 'NotOneOf':
          return true;
  }

  return false;
}

interface IReadableOp {
  title: string,
  content: string
}

interface IRuleValue {
  exptRollout: null | number,
  rolloutPercentage: number[],
  valueOption: IValueOption
}

interface IFeatureFlagDetail {
  defaultRulePercentageRollouts: IRuleValue[]
}

interface IRuleClause {
  operation: string | null,
  property: string,
  value: string
}

interface IRule {
  isIncludedInExpt: boolean | null,
  ruleId: string,
  ruleName: string,
  ruleJsonContent: IRuleClause[],
  valueOptionsVariationRuleValues: IRuleValue[]
}

interface IFeatureFlag {
  targetIndividuals: ITargetIndividual[],
  ff: IFeatureFlagDetail,
  fftuwmtr: IRule[]
}

interface ITargetIndividual {
  individuals: IIndividual[],
  valueOption: IValueOption
}

interface IIndividual {
  id: string,
  keyId: string,
  name: string
}

///********flat******** */

interface IFlatTargetIndividual {
  variationId: number | string,
  valueOption: IValueOption,
  individuals: IIndividual[]
}

interface IFlatRuleClausesWrapper {
  id: string,
  rule?: IRule,
  items: IFlatRuleClause[]
}

interface IFlatVariationOptionsWrapper {
  id: string,
  rule?: IRule,
  items: IFlatRuleValue[]
}

interface IFlatRule {
  isIncludedInExpt: boolean | null,
  ruleId: string,
  ruleName: string,
  ruleJsonContent: IFlatRuleClausesWrapper[],
  valueOptionsVariationRuleValues: IFlatVariationOptionsWrapper[]
}

interface IFlatFeatureFlag {
  targetIndividuals: IFlatTargetIndividual [],
  defaultRulePercentageRollouts: IFlatRuleValue[],
  fftuwmtr: IFlatRule[]
}

const ruleValueConfig = [
  {
      label: '为真',
      value: 'IsTrue',
      type: '',
      default: 'IsTrue'
  },{
      label: '为假',
      value: 'IsFalse',
      type: '',
      default: 'IsFalse'
  },{
      label: '等于',
      value: 'Equal',
      type: 'string'
  },{
      label: '不等于',
      value: 'NotEqual',
      type: 'string',
      default: ''
  },{
      label: '小于',
      value: 'LessThan',
      type: 'number',
      default: ''
  },{
      label: '大于',
      value: 'BiggerThan',
      type: 'number',
      default: ''
  },{
      label: '小于等于',
      value: 'LessEqualThan',
      type: 'number',
      default: ''
  },{
      label: '大于等于',
      value: 'BiggerEqualThan',
      type: 'number',
      default: ''
  },{
      label: '属于',
      value: 'IsOneOf',
      type: 'multi',
      default: ''
  },{
      label: '不属于',
      value: 'NotOneOf',
      type: 'multi',
      default: ''
  },{
      label: '包含',
      value: 'Contains',
      type: 'string',
      default: ''
  },{
      label: '不包含',
      value: 'NotContain',
      type: 'string',
      default: ''
  },{
      label: '以指定字符串开头',
      value: 'StartsWith',
      type: 'string',
      default: ''
  },{
      label: '以指定字符串结尾',
      value: 'EndsWith',
      type: 'string',
      default: ''
  },{
    label: '正则匹配',
    value: 'MatchRegex',
    type: 'regex',
    default: ''
  },{
    label: '正则不匹配',
    value: 'NotMatchRegex',
    type: 'regex',
    default: ''
  }
]
