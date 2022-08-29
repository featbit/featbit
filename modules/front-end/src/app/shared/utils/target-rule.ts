import { IFftuwmtrParams, IJsonContent } from "@main/switch-manage/types/switch-new";

export function handleRulesBeforeSave(rules: IFftuwmtrParams[]) {
  let filteredRules = rules.filter(rule => rule.ruleJsonContent.length > 0);

  // handle rule value
  filteredRules.forEach((rule: IFftuwmtrParams) => {
    rule.ruleJsonContent.forEach((rule: IJsonContent) => {
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
