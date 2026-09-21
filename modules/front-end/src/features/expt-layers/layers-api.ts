import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  Layer,
  LayerPayload,
  LayerUpdatePayload,
  PagedLayers,
} from "./layers-types"

function layersPath(envId: string, suffix = "") {
  return `/api/v1/envs/${encodeURIComponent(envId)}/experiment-layers${suffix}`
}

export function fetchLayers(
  envId: string,
  input: {
    search: string
    status: "active" | "archived"
    pageIndex: number
    pageSize: number
  }
) {
  const params = new URLSearchParams({
    searchText: input.search,
    status: input.status,
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  return fetchApi<PagedLayers>(`${layersPath(envId)}?${params}`)
}

export function createLayer(envId: string, payload: LayerPayload) {
  return fetchApi<Layer>(layersPath(envId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateLayer(
  envId: string,
  layerId: string,
  payload: LayerUpdatePayload
) {
  return fetchApi<Layer>(layersPath(envId, `/${encodeURIComponent(layerId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function archiveLayer(envId: string, layerId: string) {
  return fetchApi<boolean>(
    layersPath(envId, `/${encodeURIComponent(layerId)}/archive`),
    { method: "PUT" }
  )
}

export function restoreLayer(envId: string, layerId: string) {
  return fetchApi<boolean>(
    layersPath(envId, `/${encodeURIComponent(layerId)}/restore`),
    { method: "PUT" }
  )
}
