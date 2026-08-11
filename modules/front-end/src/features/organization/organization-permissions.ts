import type { OrganizationUserPolicy } from "./organization-api"
import { canUseAction } from "@/features/iam/policy-matcher"

export type OrganizationAction =
  | "UpdateOrgName"
  | "UpdateOrgSortFlagsBy"
  | "UpdateOrgDefaultUserPermissions"
  | "CreateOrg"

export function canUseOrganizationAction(
  policies: OrganizationUserPolicy[],
  action: OrganizationAction
) {
  return canUseAction(policies, "organization/*", action)
}
