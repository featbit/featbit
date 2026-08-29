import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  CreateExperimentPayload,
  ExperimentListItem,
  ExperimentStage,
  PagedExperiments,
} from "./experiment-types"

function experimentsPath(envId: string) {
  return `/api/v1/envs/${encodeURIComponent(envId)}/experiments`
}

export function fetchExperiments(
  envId: string,
  input: {
    name: string
    flagKey: string
    stage: ExperimentStage | "all"
    pageIndex: number
    pageSize: number
  }
) {
  const params = new URLSearchParams({
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  if (input.name) params.set("name", input.name)
  if (input.flagKey) params.set("flagKey", input.flagKey)
  if (input.stage !== "all") params.set("stage", input.stage)

  return fetchApi<PagedExperiments>(`${experimentsPath(envId)}?${params}`)
}

export function createExperiment(
  envId: string,
  payload: CreateExperimentPayload
) {
  return fetchApi<ExperimentListItem>(experimentsPath(envId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
