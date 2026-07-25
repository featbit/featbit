import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  CopyPrecheckResult,
  FlagComparisonDetail,
  FlagCreationPayload,
  FlagListFilter,
  FlagSettingCopyOptions,
  PagedFeatureFlags,
  UserPolicy,
} from "./flags-types"

function flagsPath(envId: string) {
  return `/api/v1/envs/${encodeURIComponent(envId)}/feature-flags`
}

export function fetchFeatureFlags(envId: string, filter: FlagListFilter) {
  const params = new URLSearchParams({
    name: filter.name,
    isArchived: String(filter.isArchived),
    sortBy: filter.sortBy,
    pageIndex: String(filter.pageIndex - 1),
    pageSize: String(filter.pageSize),
  })
  filter.tags.forEach((tag) => params.append("tags", tag))
  if (filter.isEnabled !== undefined) {
    params.set("isEnabled", String(filter.isEnabled))
  }
  return fetchApi<PagedFeatureFlags>(`${flagsPath(envId)}?${params}`)
}

export function fetchFeatureFlagTags(envId: string) {
  return fetchApi<string[]>(`${flagsPath(envId)}/all-tags`)
}

export function fetchFlagPolicies() {
  return fetchApi<UserPolicy[]>("/api/v1/user/policies")
}

type ProjectWithSettings = {
  environments?: Array<{
    id: string
    settings?: { requireChangeComment?: boolean }
  }>
}

export async function fetchFlagEnvironmentSettings(envId: string) {
  const projects = await fetchApi<ProjectWithSettings[]>("/api/v1/projects")
  const environment = projects
    .flatMap((project) => project.environments ?? [])
    .find((item) => item.id === envId)
  return {
    requireChangeComment: environment?.settings?.requireChangeComment ?? false,
  }
}

export function toggleFeatureFlag(
  envId: string,
  key: string,
  enabled: boolean,
  comment = ""
) {
  return fetchApi<string>(
    `${flagsPath(envId)}/${encodeURIComponent(key)}/toggle/${enabled}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }
  )
}

export function archiveFeatureFlag(envId: string, key: string, comment = "") {
  return fetchApi<boolean>(
    `${flagsPath(envId)}/${encodeURIComponent(key)}/archive`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }
  )
}

export function restoreFeatureFlag(envId: string, key: string, comment = "") {
  return fetchApi<boolean>(
    `${flagsPath(envId)}/${encodeURIComponent(key)}/restore`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }
  )
}

export function removeFeatureFlag(envId: string, key: string, comment = "") {
  return fetchApi<boolean>(`${flagsPath(envId)}/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  })
}

export function isFeatureFlagKeyUsed(envId: string, key: string) {
  const params = new URLSearchParams({ key })
  return fetchApi<boolean>(`${flagsPath(envId)}/is-key-used?${params}`)
}

export function createFeatureFlag(envId: string, payload: FlagCreationPayload) {
  return fetchApi<{ key?: string }>(flagsPath(envId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function cloneFeatureFlag(
  envId: string,
  sourceKey: string,
  payload: { name: string; key: string; description: string; tags: string[] }
) {
  return fetchApi<unknown>(
    `${flagsPath(envId)}/clone/${encodeURIComponent(sourceKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function precheckCopyFeatureFlags(
  envId: string,
  targetEnvId: string,
  flagIds: string[]
) {
  return fetchApi<CopyPrecheckResult[]>(
    `${flagsPath(envId)}/copy-to-env-precheck/${encodeURIComponent(targetEnvId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flagIds),
    }
  )
}

export function copyFeatureFlags(
  envId: string,
  targetEnvId: string,
  flagIds: string[],
  precheckResults: CopyPrecheckResult[]
) {
  return fetchApi<{ copiedCount: number }>(
    `${flagsPath(envId)}/copy-to-env/${encodeURIComponent(targetEnvId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagIds, precheckResults }),
    }
  )
}

export function compareFeatureFlag(
  envId: string,
  targetEnvId: string,
  flagKey: string
) {
  return fetchApi<FlagComparisonDetail | null>(
    `${flagsPath(envId)}/${encodeURIComponent(flagKey)}/compare-with/${encodeURIComponent(targetEnvId)}`
  )
}

export function copyFeatureFlagSettings(
  envId: string,
  targetEnvId: string,
  flagKey: string,
  options: FlagSettingCopyOptions
) {
  return fetchApi<unknown>(
    `${flagsPath(envId)}/${encodeURIComponent(flagKey)}/copy-settings-to/${encodeURIComponent(targetEnvId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options }),
    }
  )
}
