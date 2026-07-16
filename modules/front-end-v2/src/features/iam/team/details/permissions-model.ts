import {
  PERMISSION_ACTIONS,
  RESOURCE_PATTERNS,
  type ResourceType,
} from "@/features/iam/policies/details/permission-model"
import type {
  MemberPermission,
  MemberPermissionEvaluation,
} from "./permissions-api"

export type MemberPermissionPolicyGroup = {
  policyId: string
  policyName: string
  policyType: string
  permissions: MemberPermission[]
  statementIds: string[]
  effects: MemberPermission["effect"][]
  sources: MemberPermission["sources"]
}

export function permissionActionFallback(actionName: string) {
  return (
    PERMISSION_ACTIONS.find((action) => action.name === actionName)?.label ??
    actionName
  )
}

export function isAllResourceScope(
  resourceType: ResourceType,
  resources: readonly string[]
) {
  return resources.includes(RESOURCE_PATTERNS[resourceType])
}

export function isWildcardResource(resource: string) {
  return resource === "*" || resource.endsWith("/*")
}

export function matchesPermissionQuery(
  permission: MemberPermission,
  query: string,
  localizedValues: readonly string[] = []
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true

  return [
    permission.effect,
    permission.policyName,
    permission.policyType,
    permission.resourceType,
    ...permission.actions,
    ...permission.resources,
    ...permission.sources.flatMap((source) => [
      source.assignmentType,
      source.groupName ?? "",
    ]),
    ...localizedValues,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
}

export function groupMemberPermissionsByPolicy(
  permissions: readonly MemberPermission[]
): MemberPermissionPolicyGroup[] {
  const groups = new Map<string, MemberPermission[]>()

  for (const permission of permissions) {
    const group = groups.get(permission.policyId)
    if (group) group.push(permission)
    else groups.set(permission.policyId, [permission])
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0]
    const sourceMap = new Map<string, MemberPermission["sources"][number]>()

    for (const source of group.flatMap((permission) => permission.sources)) {
      const key = `${source.assignmentType}:${source.groupId ?? ""}:${source.groupName ?? ""}`
      if (!sourceMap.has(key)) sourceMap.set(key, source)
    }

    return {
      policyId: first.policyId,
      policyName: first.policyName,
      policyType: first.policyType,
      permissions: group,
      statementIds: Array.from(
        new Set(group.map((permission) => permission.statementId))
      ),
      effects: (["deny", "allow"] as const).filter((effect) =>
        group.some((permission) => permission.effect === effect)
      ),
      sources: Array.from(sourceMap.values()),
    }
  })
}

export function focusStatementIdForDecision(
  policy: MemberPermissionPolicyGroup,
  decision: MemberPermissionEvaluation["decision"]
) {
  const preferredEffect =
    decision === "explicitDeny"
      ? "deny"
      : decision === "allowed"
        ? "allow"
        : null

  return (
    policy.permissions.find(
      (permission) => permission.effect === preferredEffect
    )?.statementId ?? policy.statementIds[0]
  )
}
