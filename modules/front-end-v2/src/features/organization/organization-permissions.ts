import type { OrganizationUserPolicy } from "./organization-api"

export type OrganizationAction =
  | "UpdateOrgName"
  | "UpdateOrgSortFlagsBy"
  | "UpdateOrgDefaultUserPermissions"
  | "CreateOrg"

function wildcardMatch(value: string, pattern: string) {
  const expression = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*")
  return new RegExp(`^${expression}$`).test(value)
}

export function canUseOrganizationAction(
  policies: OrganizationUserPolicy[],
  action: OrganizationAction
) {
  const matching = policies
    .flatMap((policy) => policy.statements ?? [])
    .filter((statement) => {
      if (statement.resourceType === "*") {
        return true
      }

      return (
        statement.resourceType === "organization" &&
        statement.actions.some(
          (statementAction) =>
            statementAction === "*" || statementAction === action
        ) &&
        statement.resources.some((resource) =>
          wildcardMatch("organization/*", resource)
        )
      )
    })

  return (
    matching.length > 0 &&
    matching.every((statement) => statement.effect === "allow")
  )
}
