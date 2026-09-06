import { fetchApi } from "@/lib/api/authenticated-api"
import type { ExperimentDetail } from "../details/experiment-details-types"
import type {
  ExperimentListData,
  ExperimentListDataItem,
} from "./experiment-list-state"
import type {
  CreateExperimentPayload,
  ExperimentListItem,
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
    pageIndex: number
    pageSize: number
  },
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  if (input.name) params.set("name", input.name)
  if (input.flagKey) params.set("flagKey", input.flagKey)
  return fetchApi<PagedExperiments>(`${experimentsPath(envId)}?${params}`, {
    signal,
  })
}

async function loadListStateData(
  envId: string,
  items: ExperimentListItem[],
  signal?: AbortSignal
): Promise<ExperimentListDataItem[]> {
  const result: ExperimentListDataItem[] = []
  // The list endpoint omits decisions, learning and observation windows.
  // Limit concurrent detail reads; never persist a display state via /stage.
  for (let offset = 0; offset < items.length; offset += 5) {
    signal?.throwIfAborted()
    const batch = await Promise.all(
      items.slice(offset, offset + 5).map(async (item) => {
        if (!item.runCount)
          return { ...item, experimentRuns: [], lastLearning: null }
        const detail = await fetchApi<ExperimentDetail>(
          `${experimentsPath(envId)}/${encodeURIComponent(item.id)}`,
          { signal }
        )
        return {
          ...item,
          flagKey: detail.flagKey,
          runCount: detail.experimentRuns.length,
          experimentRuns: detail.experimentRuns,
          lastLearning: detail.lastLearning,
        }
      })
    )
    result.push(...batch)
  }
  return result
}

export async function fetchExperimentList(
  envId: string,
  input: Parameters<typeof fetchExperiments>[1] & { scope: "page" | "all" },
  signal?: AbortSignal
): Promise<ExperimentListData> {
  const pageSize = input.scope === "all" ? 100 : input.pageSize
  let pageIndex = input.scope === "all" ? 0 : input.pageIndex
  let totalCount: number
  const items: ExperimentListDataItem[] = []
  do {
    signal?.throwIfAborted()
    const page = await fetchExperiments(
      envId,
      {
        ...input,
        pageIndex,
        pageSize,
      },
      signal
    )
    totalCount = page.totalCount
    items.push(...(await loadListStateData(envId, page.items, signal)))
    pageIndex += 1
    if (input.scope === "page" || !page.items.length) break
  } while (pageIndex * pageSize < totalCount)

  return { items, totalCount, scope: input.scope }
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
