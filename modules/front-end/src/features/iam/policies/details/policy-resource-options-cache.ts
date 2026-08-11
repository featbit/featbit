import type { QueryClient } from "@tanstack/react-query"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { fetchPolicyResources } from "./policy-details-api"
import type { ResourceType } from "./permission-model"

const policyResourceOptionsRootKey = ["iam", "policy-resource-options"] as const
const policyResourceOptionsStaleTime = 30_000

export function policyResourceOptionsQuery(
  resourceType: ResourceType,
  search: string
) {
  const normalizedSearch = search.trim()
  const workspaceId = getCurrentWorkspace()?.id ?? ""
  const organizationId = getCurrentOrganization()?.id ?? ""

  return {
    queryKey: [
      ...policyResourceOptionsRootKey,
      workspaceId,
      organizationId,
      resourceType,
      normalizedSearch,
    ] as const,
    queryFn: () => fetchPolicyResources(normalizedSearch, resourceType),
    staleTime: policyResourceOptionsStaleTime,
  }
}

export function fetchPolicyResourceOptions(
  queryClient: QueryClient,
  resourceType: ResourceType,
  search: string
) {
  return queryClient.fetchQuery(
    policyResourceOptionsQuery(resourceType, search)
  )
}
