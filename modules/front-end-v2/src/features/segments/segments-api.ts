import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  EnvironmentSettings,
  AuditInstruction,
  PagedSegments,
  ScopeResource,
  Segment,
  SegmentFlagReference,
  SegmentEndUser,
  SegmentPayload,
  SegmentRule,
  SegmentType,
  SegmentUserProperty,
} from "./segments-types"

function segmentBasePath(envId: string) {
  return `/api/v1/envs/${encodeURIComponent(envId)}/segments`
}

export function fetchSegment(envId: string, segmentId: string) {
  return fetchApi<Segment>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}`
  )
}

export function fetchSegmentsByIds(envId: string, segmentIds: string[]) {
  const params = new URLSearchParams()
  segmentIds.forEach((segmentId) => params.append("ids", segmentId))
  return fetchApi<Segment[]>(`${segmentBasePath(envId)}/by-ids?${params}`)
}

export function updateSegmentTargeting(
  envId: string,
  segmentId: string,
  payload: {
    included: string[]
    excluded: string[]
    rules: SegmentRule[]
    comment: string
  }
) {
  return fetchApi<boolean>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}/targeting`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function updateSegmentGeneral(
  envId: string,
  segmentId: string,
  input: { name: string; description: string; tags: string[] },
  comment = ""
) {
  return fetchApi<boolean>(
    `${segmentBasePath(envId)}/${encodeURIComponent(segmentId)}/general`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, comment }),
    }
  )
}

export function fetchAllSegmentTags(envId: string) {
  return fetchApi<string[]>(`${segmentBasePath(envId)}/all-tags`)
}

export function fetchSegmentUsersByKeyIds(envId: string, keyIds: string[]) {
  return fetchApi<SegmentEndUser[]>(
    `/api/v1/envs/${encodeURIComponent(envId)}/end-users/by-keyIds`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keyIds),
    }
  )
}

export function searchSegmentUsers(
  envId: string,
  input: {
    searchText: string
    excludedKeyIds: string[]
    globalUserOnly: boolean
    limit?: number
  }
) {
  return fetchApi<SegmentEndUser[]>(
    `/api/v1/envs/${encodeURIComponent(envId)}/end-users/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, limit: input.limit ?? 20 }),
    }
  )
}

export function createSegmentEndUser(envId: string, keyId: string) {
  return fetchApi<SegmentEndUser>(
    `/api/v1/envs/${encodeURIComponent(envId)}/end-users`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, name: keyId }),
    }
  )
}

export function fetchSegmentUserProperties(envId: string) {
  return fetchApi<SegmentUserProperty[]>(
    `/api/v1/envs/${encodeURIComponent(envId)}/end-user-properties`
  )
}

export function compareSegmentData(
  envId: string,
  previous: string,
  current: string
) {
  return fetchApi<AuditInstruction[]>(
    `/api/v1/envs/${encodeURIComponent(envId)}/audit-logs/compare`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refType: "Segment",
        dataChange: { previous, current },
      }),
    }
  )
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
