export interface IRule {
  id: string,
  name: string,
  conditions: ICondition[],
  dispatchKey: string;

  // for feature flag
  variations?: IRuleVariation[],
  includedInExpt?: boolean,
  isNotPercentageRollout?: boolean,
}

export interface IRuleOp {
  label: string;
  value: string;
  type?: string;
  default?: string;
}

export const RULE_OPS: IRuleOp[] = [
  {
    label: $localize `:@@core.rule.operators.istrue:is true`,
    value: 'IsTrue',
    type: 'boolean',
    default: 'IsTrue'
  },{
    label: $localize `:@@core.rule.operators.isfalse:is false`,
    value: 'IsFalse',
    type: 'boolean',
    default: 'IsFalse'
  },{
    label: $localize `:@@core.rule.operators.equals:equals`,
    value: 'Equal',
    type: 'string'
  },{
    label: $localize `:@@core.rule.operators.notequal:not equal`,
    value: 'NotEqual',
    type: 'string',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.lessthan:less than`,
    value: 'LessThan',
    type: 'number',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.biggerthan:bigger than`,
    value: 'BiggerThan',
    type: 'number',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.lessequalthan:less equal than`,
    value: 'LessEqualThan',
    type: 'number',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.biggerequalthan:bigger equal than`,
    value: 'BiggerEqualThan',
    type: 'number',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.isoneof:is one of`,
    value: 'IsOneOf',
    type: 'multi',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.notoneof:not one of`,
    value: 'NotOneOf',
    type: 'multi',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.contains:contains`,
    value: 'Contains',
    type: 'string',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.notcontain:not contain`,
    value: 'NotContain',
    type: 'string',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.startwith:start with`,
    value: 'StartsWith',
    type: 'string',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.endswith:ends with`,
    value: 'EndsWith',
    type: 'string',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.matchregex:match regex`,
    value: 'MatchRegex',
    type: 'regex',
    default: ''
  },{
    label: $localize `:@@core.rule.operators.notmatchregex:not match regex`,
    value: 'NotMatchRegex',
    type: 'regex',
    default: ''
  }
]

export interface ICondition {
  id: string,
  property: string,
  op: string,
  value: string,

  // UI only
  multipleValue?: string[];
  type?: string;
  isSingleOperator?: boolean,
  isSegment?: boolean
}

export interface IVariation {
  id: string,
  name: string,
  value: string
}

export interface IRuleVariation {
  id: string; // variation id

  rollout: number[]; // only two elements, sta
  exptRollout: number; // 0.45 means 45%

  // UI only
  percentage?: number; // the percentage representation of rolloutPercentage
  exptPercentage?: number;  // the percentage representation of exptRollout
  isInvalid?: boolean
  label?: string // variation label
}

export function handleRulesBeforeSave(rules: IRule[]) {
  let filteredRules = rules.filter(rule => rule.conditions.length > 0);

  // handle rule value
  filteredRules.forEach((rule: IRule) => {
    rule.conditions.forEach((condition: ICondition) => {
      if(condition.type === 'multi') {
        condition.value = JSON.stringify(condition.multipleValue);
      }
      if(condition.type === 'number') {
        condition.value = condition.value.toString();
      }
    })
  });

  return filteredRules;
}

export function isNotPercentageRollout(variations: IRuleVariation[]) : boolean {
  return variations.length === 0 || (variations.length === 1 && variations[0].rollout.length === 2 && variations[0].rollout[0] === 0 && variations[0].rollout[1] === 1);
}
