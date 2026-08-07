import { queryOptions } from "@tanstack/react-query"
import {
  clearCurrentProjectEnv,
  persistCurrentOrganization,
} from "@/features/layout/layout-context"
import type { Organization } from "@/features/layout/layout-types"
import { fetchApi } from "@/lib/api/authenticated-api"

export type FlagSortedBy = "created_at" | "key"

export type OrganizationSettings = {
  flagSortedBy: FlagSortedBy
}

export type OrganizationDefaultPermissions = {
  policyIds: string[]
  groupIds: string[]
}

export type OrganizationDetails = Organization & {
  settings: OrganizationSettings
  defaultPermissions: OrganizationDefaultPermissions
}

export type UpdateOrganizationPayload = {
  name: string
  settings: OrganizationSettings
  defaultPermissions: OrganizationDefaultPermissions
}

export type OrganizationPolicy = {
  id: string
  type: "SysManaged" | "CustomerManaged" | string
  name: string
  key: string
  description?: string
}

export type OrganizationGroup = {
  id: string
  name: string
  description?: string
}

export type OrganizationDefaultPermissionOptions = {
  policies: OrganizationPolicy[]
  groups: OrganizationGroup[]
}

export type PagedResult<T> = {
  totalCount: number
  items: T[]
}

export type OrganizationUserPolicy = {
  name: string
  type: string
  statements?: Array<{
    resourceType: string
    effect: string
    actions: string[]
    resources: string[]
  }>
}

async function organizationRequest<T>(path: string, init?: RequestInit) {
  return fetchApi<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

export function normalizeOrganization(
  organization: Organization | null
): OrganizationDetails | null {
  if (!organization) {
    return null
  }

  const partial = organization as Partial<OrganizationDetails>

  const rawFlagSortedBy = partial.settings?.flagSortedBy as string | undefined
  const flagSortedBy =
    rawFlagSortedBy === "Key"
      ? "key"
      : rawFlagSortedBy === "CreatedAt"
        ? "created_at"
        : rawFlagSortedBy === "key" || rawFlagSortedBy === "created_at"
          ? rawFlagSortedBy
          : undefined

  return {
    ...organization,
    settings: {
      ...partial.settings,
      flagSortedBy: flagSortedBy ?? "created_at",
    },
    defaultPermissions: partial.defaultPermissions ?? {
      policyIds: [],
      groupIds: [],
    },
  }
}

export async function updateOrganization(
  currentOrganization: OrganizationDetails,
  payload: UpdateOrganizationPayload
) {
  await organizationRequest<unknown>("/api/v1/organizations", {
    method: "PUT",
    body: JSON.stringify(payload),
  })

  const updatedOrganization: OrganizationDetails = {
    ...currentOrganization,
    ...payload,
  }
  persistCurrentOrganization(updatedOrganization)
  return updatedOrganization
}

export async function isOrganizationKeyUsed(key: string) {
  return organizationRequest<boolean>(
    `/api/v1/organizations/is-key-used?key=${encodeURIComponent(key)}`
  )
}

export async function createOrganization(payload: {
  name: string
  key: string
}) {
  const organization = await organizationRequest<OrganizationDetails>(
    "/api/v1/organizations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )
  const normalizedOrganization = normalizeOrganization(organization)!
  persistCurrentOrganization(normalizedOrganization)
  clearCurrentProjectEnv()
  return normalizedOrganization
}

function pageQuery(search: string, pageSize: number) {
  const params = new URLSearchParams({
    name: search,
    pageIndex: "0",
    pageSize: String(pageSize),
  })

  return params.toString()
}

export async function fetchOrganizationPolicies(search = "", pageSize = 50) {
  return organizationRequest<PagedResult<OrganizationPolicy>>(
    `/api/v1/policies?${pageQuery(search, pageSize)}`
  )
}

export async function fetchOrganizationGroups(search = "", pageSize = 50) {
  return organizationRequest<PagedResult<OrganizationGroup>>(
    `/api/v1/groups?${pageQuery(search, pageSize)}`
  )
}

export function fetchOrganizationDefaultPermissionOptions() {
  return organizationRequest<OrganizationDefaultPermissionOptions>(
    "/api/v1/organizations/default-permissions"
  )
}

export const organizationQueryKeys = {
  defaultPermissionOptions: (organizationId: string) =>
    ["organization", organizationId, "default-permission-options"] as const,
  policies: (organizationId: string) =>
    ["organization", organizationId, "policies"] as const,
  groups: (organizationId: string) =>
    ["organization", organizationId, "groups"] as const,
}

export function organizationDefaultPermissionOptionsQueryOptions(
  organizationId: string
) {
  return queryOptions({
    queryKey: organizationQueryKeys.defaultPermissionOptions(organizationId),
    queryFn: fetchOrganizationDefaultPermissionOptions,
    staleTime: 60_000,
  })
}

export function organizationPoliciesQueryOptions(organizationId: string) {
  return queryOptions({
    queryKey: organizationQueryKeys.policies(organizationId),
    queryFn: () => fetchOrganizationPolicies(),
    staleTime: 60_000,
  })
}

export function organizationGroupsQueryOptions(organizationId: string) {
  return queryOptions({
    queryKey: organizationQueryKeys.groups(organizationId),
    queryFn: () => fetchOrganizationGroups(),
    staleTime: 60_000,
  })
}
