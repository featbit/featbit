import type { FeatureFlag, UserPolicy } from "./flags-types"
import {
  canUseAction,
  canUseAllActions,
  hasOwnerPolicy,
} from "@/features/iam/policy-matcher"

export type FlagAction =
  | "CreateFlag"
  | "ToggleFlag"
  | "CopyFlagTo"
  | "CloneFlag"
  | "ArchiveFlag"
  | "RestoreFlag"
  | "DeleteFlag"
  | "UpdateFlagName"
  | "UpdateFlagDescription"
  | "UpdateFlagTags"
  | "UpdateFlagVariations"
  | "UpdateFlagIndividualTargeting"
  | "UpdateFlagTargetingRules"
  | "UpdateFlagDefaultRule"
  | "UpdateFlagOffVariation"

export function environmentRn(input: {
  projectKey: string
  environmentKey: string
}) {
  return `project/${input.projectKey}:env/${input.environmentKey}`
}

export function featureFlagRn(
  envRn: string,
  flag: Pick<FeatureFlag, "key" | "tags">
) {
  const tags = flag.tags?.length ? `;${flag.tags.join(",")}` : ""
  return `${envRn}:flag/${flag.key}${tags}`
}

export function canUseFlagAction(
  policies: UserPolicy[],
  resourceRn: string,
  action: FlagAction,
  fineGrainedGranted: boolean
) {
  const actionAllowed = canUseAction(policies, resourceRn, action)

  return Boolean(
    actionAllowed &&
    (fineGrainedGranted ||
      hasOwnerPolicy(policies) ||
      canUseAllActions(policies, resourceRn))
  )
}
