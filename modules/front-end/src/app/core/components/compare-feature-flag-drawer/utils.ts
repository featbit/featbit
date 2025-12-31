import { IRule, IRuleVariation, IVariation } from "@shared/rules";
import { IFallthrough, IFeatureFlag, IVariationUser } from "@features/safe/feature-flags/types/details";
import { TargetingRuleDiff } from "@features/safe/feature-flags/types/compare-flag";
import { uuidv4 } from "@utils/index";

export function describeServe(serve: {
  variations: IRuleVariation[],
  dispatchKey: string
}, variations: IVariation[]): string {
  const ruleVariations = serve.variations;
  if (ruleVariations.length === 1) {
    const servedVariation = variations.find(v => v.id === ruleVariations[0].id);
    return servedVariation ? servedVariation.name : '';
  }

  let serves: string[] = [];
  for (let rv of ruleVariations) {
    const servedVariation = variations.find(v => v.id === rv.id);
    if (servedVariation) {
      const percentage = Math.round((rv.rollout[1] - rv.rollout[0]) * 100);
      serves.push(`${percentage}% ${servedVariation.name}`);
    }
  }

  serves.push($localize`:@@common.dispatch-by:dispatch by` + ` ${serve.dispatchKey}`);
  return serves.join(', ');
}

export function getAppliedTargetUsers(
  source: IFeatureFlag,
  target: IFeatureFlag,
  targetVariations: IVariation[],
  copyMode: string): IVariationUser[] {
  const newValue: IVariationUser[] = [];

  for (const targetVariation of targetVariations) {
    const sourceKeyIds = source.targetUsers.find(stu => {
      const sourceVariation = source.variations.find(v => v.value === targetVariation.value);
      return stu.variationId === sourceVariation.id;
    })?.keyIds ?? [];

    if (copyMode === 'overwrite') {
      newValue.push({
        variationId: targetVariation.id,
        keyIds: sourceKeyIds
      });
    } else {
      const targetKeyIds =
        target.targetUsers.find(ttu => ttu.variationId === targetVariation.id)?.keyIds || [];

      newValue.push({
        variationId: targetVariation.id,
        keyIds: [ ...new Set([ ...targetKeyIds, ...sourceKeyIds ]) ]
      });
    }
  }

  return newValue;
}


export function getAppliedTargetRules(
  source: IFeatureFlag,
  target: IFeatureFlag,
  ruleDiffs: TargetingRuleDiff[],
  copyMode: string): IRule[] {
  function mapSourceRule(rule: IRule) {
    const newRuleVariations: IRuleVariation[] = rule.variations.map(sv => {
      const sourceVariation = source.variations.find(v => v.id === sv.id);
      const targetVariation = target.variations.find(tv => tv.value === sourceVariation.value);
      return {
        ...sv,
        id: targetVariation.id
      }
    });

    return {
      ...rule,
      id: uuidv4(),
      variations: newRuleVariations
    }
  }

  if (copyMode === 'overwrite') {
    return source.rules.map(sourceRule => mapSourceRule(sourceRule));
  }

  // append new targeting rules
  const newValue: IRule[] = [];

  // add existing target rules first
  newValue.push(...target.rules);

  // add different source rules
  for (let sourceRule of source.rules) {
    const diff = ruleDiffs.find(x => x.source?.id === sourceRule.id);
    if (diff.isDifferent) {
      newValue.push(mapSourceRule(sourceRule));
    }
  }

  return newValue;
}

export function getAppliedDefaultRule(source: IFeatureFlag, targetVariations: IVariation[]): IFallthrough {
  return {
    ...source.fallthrough,
    variations: source.fallthrough.variations.map(sv => {
      const sourceVariation = source.variations.find(v => v.id === sv.id);
      const targetVariation = targetVariations.find(tv => tv.value === sourceVariation.value);
      return {
        ...sv,
        id: targetVariation.id
      }
    })
  }
}

export function getAppliedOffVariation(source: IFeatureFlag, targetVariations: IVariation[]): string {
  const sourceVariation = source.variations.find(v => v.id === source.disabledVariationId);
  const targetVariation = targetVariations.find(tv => tv.value === sourceVariation.value);
  return targetVariation.id;
}
