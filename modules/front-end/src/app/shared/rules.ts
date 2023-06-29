export interface IRule {
  id: string,
  name: string,
  conditions: ICondition[],
  dispatchKey: string;

  // for feature flag
  variations?: IRuleVariation[],
  includedInExpt: boolean,
  isNotPercentageRollout: boolean,
}

export interface ICondition {
  property: string,
  op: string,
  value: string,

  // UI only
  multipleValue?: string[];
  type?: string;
  isSingleOperator: boolean,
  isSegment: boolean
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
