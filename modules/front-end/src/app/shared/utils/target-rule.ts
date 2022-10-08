import {ICondition, ISegmentRule} from "@shared/rules";

export function handleRulesBeforeSave(rules: ISegmentRule[]) {
  let filteredRules = rules.filter(rule => rule.conditions.length > 0);

  // handle rule value
  filteredRules.forEach((rule: ISegmentRule) => {
    rule.conditions.forEach((rule: ICondition) => {
      if(rule.type === 'multi') {
        rule.value = JSON.stringify(rule.multipleValue);
      }
      if(rule.type === 'number') {
        rule.value = rule.value.toString();
      }
    })
  });

  return filteredRules;
}
