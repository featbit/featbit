import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  EnvironmentSettings,
  PagedSegments,
  ScopeResource,
  Segment,
  SegmentFlagReference,
  SegmentPayload,
  SegmentType,
  UserPolicy,
} from "./segments-types"

function segmentBasePath(envId: string) {
  return `/api/v1/envs/${encodeURIComponent(envId)}/segments`
}

export function fetchSegments(
  envId: string,
  input: {
    name: string
    isArchived: boolean
    pageIndex: number
    pageSize: number
  }
) {
  const params = new URLSearchParams({
    name: input.name,
    isArchived: String(input.isArchived),
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  return fetchApi<PagedSegments>(`${segmentBasePath(envId)}?${params}`)
}

export function isSegmentKeyUsed(
  envId: string,
  key: string,
  type: SegmentType
) {
  const params = new URLSearchParams({ key, type })
  return fetchApi<boolean>(`${segmentBasePath(envId)}/is-key-used?${params}`)
}

export function createSegment(envId: string, payload: SegmentPayload) {
  return fetchApi<Segment>(segmentBasePath(envId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function fetchSegmentFlagReferences(envId: string, segmentId: string) {
  return fetchApi<SegmentFlagReference[]>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}/flag-references`
  )
}

export function archiveSegment(
  envId: string,
  segmentId: string,
  comment?: string
) {
  return fetchApi<boolean>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}/archive`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || undefined }),
    }
  )
}

export function restoreSegment(
  envId: string,
  segmentId: string,
  comment?: string
) {
  return fetchApi<boolean>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}/restore`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || undefined }),
    }
  )
}

export function removeSegment(
  envId: string,
  segmentId: string,
  comment?: string
) {
  return fetchApi<boolean>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || undefined }),
    }
  )
}

export function fetchSegmentScopes(name = "") {
  const params = new URLSearchParams({ spaceLevel: "workspace", name })
  for (const type of ["organization", "project", "env"]) {
    params.append("types", type)
  }
  return fetchApi<ScopeResource[]>(`/api/v2/resources?${params}`).then(
    (resources) => resources.filter((resource) => !resource.rn.includes("*"))
  )
}

export function fetchCurrentUserPolicies() {
  return fetchApi<UserPolicy[]>("/api/v1/user/policies")
}

type ProjectWithSettings = {
  id: string
  environments?: Array<{
    id: string
    settings?: Partial<EnvironmentSettings>
  }>
}

export async function fetchCurrentEnvironmentSettings(envId: string) {
  const projects = await fetchApi<ProjectWithSettings[]>("/api/v1/projects")
  const environment = projects
    .flatMap((project) => project.environments ?? [])
    .find((item) => item.id === envId)
  return {
    requireChangeComment: environment?.settings?.requireChangeComment ?? false,
  }
}
