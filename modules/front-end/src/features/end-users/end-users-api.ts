import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  CursorPagedResult,
  EndUser,
  EndUserFilter,
  EndUserFlag,
  EndUserProperty,
  EndUserPropertyPayload,
  EndUserSegment,
  PageCursor,
  PagedResult,
} from "./end-users-types"

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

function queryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value))
    }
  })
  const value = searchParams.toString()
  return value ? `?${value}` : ""
}

function endUsersPath(envId: string) {
  return `/api/v1/envs/${envId}/end-users`
}

function propertiesPath(envId: string) {
  return `/api/v1/envs/${envId}/end-user-properties`
}

export function fetchEndUsers(
  envId: string,
  filter: EndUserFilter,
  cursor?: PageCursor
) {
  return fetchApi<CursorPagedResult<EndUser>>(
    `${endUsersPath(envId)}/list`,
    jsonRequest("POST", { ...filter, cursor })
  )
}

export function uploadEndUsers(envId: string, file: File) {
  const formData = new FormData()
  formData.set("file", file)
  return fetchApi<boolean>(`${endUsersPath(envId)}/upload`, {
    method: "POST",
    body: formData,
  })
}

export function downloadEndUsers(envId: string, filter: EndUserFilter) {
  return fetchApi<unknown>(
    `${endUsersPath(envId)}/download`,
    jsonRequest("POST", filter)
  )
}

export function fetchEndUserProperties(envId: string) {
  return fetchApi<EndUserProperty[]>(propertiesPath(envId))
}

export function upsertEndUserProperty(
  envId: string,
  propertyId: string,
  payload: EndUserPropertyPayload
) {
  return fetchApi<EndUserProperty>(
    `${propertiesPath(envId)}/${propertyId}/upsert`,
    jsonRequest("PUT", payload)
  )
}

export function removeEndUserProperty(envId: string, propertyId: string) {
  return fetchApi<boolean>(`${propertiesPath(envId)}/${propertyId}`, {
    method: "DELETE",
  })
}

export function fetchEndUserFlags(
  envId: string,
  userId: string,
  input: { searchText: string; pageIndex: number; pageSize: number }
) {
  return fetchApi<PagedResult<EndUserFlag>>(
    `${endUsersPath(envId)}/${userId}/flags${queryString({
      name: input.searchText,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    })}`
  )
}

export function fetchEndUserSegments(envId: string, userId: string) {
  return fetchApi<EndUserSegment[]>(`${endUsersPath(envId)}/${userId}/segments`)
}

export function saveJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function downloadEndUsersTemplate() {
  saveJsonFile(
    {
      users: [
        {
          keyId: "end-user-id",
          name: "end-user",
          customizedProperties: [{ name: "plan", value: "pro" }],
        },
      ],
    },
    "upload-end-users.json"
  )
}
