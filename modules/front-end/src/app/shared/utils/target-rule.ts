import { IFftuwmtrParams, IJsonContent } from "@features/safe/feature-flags/types/switch-new";

export function handleRulesBeforeSave(rules: IFftuwmtrParams[]) {
  let filteredRules = rules.filter(rule => rule.conditions.length > 0);

  // handle rule value
  filteredRules.forEach((rule: IFftuwmtrParams) => {
    rule.conditions.forEach((rule: IJsonContent) => {
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
