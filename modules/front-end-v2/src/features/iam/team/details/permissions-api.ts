import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  PolicyResource,
  ResourceType,
} from "@/features/iam/policies/details/permission-model"

export type MemberPermissionSource = {
  assignmentType: "direct" | "group"
  groupId?: string
  groupName?: string
}

export type MemberPermission = {
  statementId: string
  resourceType: ResourceType
  effect: "allow" | "deny"
  actions: string[]
  resources: string[]
  policyId: string
  policyName: string
  policyType: string
  sources: MemberPermissionSource[]
}

export type MemberPermissionEvaluation = {
  granted: boolean
  decision: "allowed" | "explicitDeny" | "noMatchingRule"
  resource: string
  action: string
  matchedRules: MemberPermission[]
}

function permissionsPath(memberId: string, suffix = "") {
  return `/api/v1/members/${encodeURIComponent(memberId)}/permissions${suffix}`
}

export function fetchMemberPermissions(memberId: string) {
  return fetchApi<MemberPermission[]>(permissionsPath(memberId))
}

export function evaluateMemberPermission(
  memberId: string,
  payload: { resource: string; action: string }
) {
  return fetchApi<MemberPermissionEvaluation>(
    permissionsPath(memberId, "/evaluate"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function fetchPermissionResources(name: string, type: ResourceType) {
  const params = new URLSearchParams()
  if (name) params.set("name", name)
  params.set("type", type)
  return fetchApi<PolicyResource[]>(`/api/v1/resources?${params.toString()}`)
}
