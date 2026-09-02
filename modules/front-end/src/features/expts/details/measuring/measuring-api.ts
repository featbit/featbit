import { fetchApi } from "@/lib/api/authenticated-api"
import type { ExperimentDetail } from "../experiment-details-types"
import type { NewRunSetup, RunAssignmentUpdate } from "./measuring-types"

function runPath(envId: string, experimentId: string, runId?: string) {
  const base = `/api/v1/envs/${encodeURIComponent(envId)}/experiments/${encodeURIComponent(experimentId)}/runs`
  return runId ? `${base}/${encodeURIComponent(runId)}` : base
}

export function createExperimentRun(envId: string, experimentId: string) {
  return fetchApi<ExperimentDetail>(runPath(envId, experimentId), {
    method: "POST",
  })
}

export function deleteExperimentRun(
  envId: string,
  experimentId: string,
  runId: string
) {
  return fetchApi<ExperimentDetail>(runPath(envId, experimentId, runId), {
    method: "DELETE",
  })
}

export function updateExperimentRunSetup(
  envId: string,
  experimentId: string,
  runId: string,
  setup: NewRunSetup
) {
  return fetchApi<ExperimentDetail>(runPath(envId, experimentId, runId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(setup),
  })
}

export function analyzeExperimentRun(
  envId: string,
  experimentId: string,
  runId: string
) {
  return fetchApi<ExperimentDetail>(
    `${runPath(envId, experimentId, runId)}/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceFresh: true }),
    }
  )
}

export function updateExperimentRunAssignment(
  envId: string,
  experimentId: string,
  runId: string,
  update: RunAssignmentUpdate
) {
  return fetchApi<ExperimentDetail>(
    `${runPath(envId, experimentId, runId)}/audience`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  )
}
