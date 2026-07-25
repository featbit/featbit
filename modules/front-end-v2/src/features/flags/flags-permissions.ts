import type { FeatureFlag, UserPolicy } from "./flags-types"

export type FlagAction =
  | "CreateFlag"
  | "ToggleFlag"
  | "CopyFlagTo"
  | "CloneFlag"
  | "ArchiveFlag"
  | "RestoreFlag"
  | "DeleteFlag"

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function environmentRn(input: {
  organizationKey: string
  projectKey: string
  environmentKey: string
}) {
  return `organization/${input.organizationKey}:project/${input.projectKey}:env/${input.environmentKey}`
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
  action: FlagAction
) {
  if (policies.some((policy) => policy.type.toLowerCase() === "owner"))
    return true

  return policies.some((policy) =>
    policy.statements.some(
      (statement) =>
        statement.effect.toLowerCase() === "allow" &&
        (statement.resourceType === "feature-flag" ||
          statement.resourceType === "flag" ||
          statement.resourceType === "*") &&
        statement.resources.some((resource) =>
          wildcardMatches(resource, resourceRn)
        ) &&
        (statement.actions.includes(action) ||
          statement.actions.includes("*") ||
          statement.actions.includes("FlagAllActions"))
    )
  )
}
