import { getIdentityToken } from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { fetchApi } from "@/lib/api/authenticated-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import type {
  ExperimentDetail,
  ExperimentDetailsUpdate,
  ExperimentLearningUpdate,
  ExperimentMetricsUpdate,
  McpTokenResponse,
} from "./experiment-details-types"

function experimentPath(envId: string, experimentId: string) {
  return `/api/v1/envs/${encodeURIComponent(envId)}/experiments/${encodeURIComponent(experimentId)}`
}

export function fetchExperimentDetail(envId: string, experimentId: string) {
  return fetchApi<ExperimentDetail>(experimentPath(envId, experimentId))
}

export function updateExperimentDetails(
  envId: string,
  experimentId: string,
  update: ExperimentDetailsUpdate | ExperimentLearningUpdate
) {
  return fetchApi<ExperimentDetail>(experimentPath(envId, experimentId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  })
}

export function advanceExperimentToExposure(
  envId: string,
  experimentId: string
) {
  return fetchApi<ExperimentDetail>(
    `${experimentPath(envId, experimentId)}/stage`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "implementing" }),
    }
  )
}

export function updateExperimentFlag(
  envId: string,
  experimentId: string,
  flagKey: string
) {
  return fetchApi<ExperimentDetail>(experimentPath(envId, experimentId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flagKey }),
  })
}

export function updateExperimentMetrics(
  envId: string,
  experimentId: string,
  update: ExperimentMetricsUpdate
) {
  return fetchApi<ExperimentDetail>(
    `${experimentPath(envId, experimentId)}/metrics`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  )
}

export function advanceExperimentToMeasuring(
  envId: string,
  experimentId: string
) {
  return fetchApi<ExperimentDetail>(
    `${experimentPath(envId, experimentId)}/stage`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "measuring" }),
    }
  )
}

export function deleteExperiment(envId: string, experimentId: string) {
  return fetchApi<boolean>(experimentPath(envId, experimentId), {
    method: "DELETE",
  })
}

export function createExperimentMcpToken(envId: string, experimentId: string) {
  return fetchApi<McpTokenResponse>(
    `/api/v1/envs/${encodeURIComponent(envId)}/mcp/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "featbit-coding-agent",
        experiment_id: experimentId,
      }),
    }
  )
}

export async function revokeExperimentMcpToken(accessToken: string) {
  const response = await fetch(
    `${getRuntimeEnv().apiUrl}/api/v1/mcp/oauth/revoke`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getIdentityToken() ?? ""}`,
        Organization: getCurrentOrganization()?.id ?? "",
        Workspace: getCurrentWorkspace()?.id ?? "",
      },
      body: JSON.stringify({ access_token: accessToken }),
    }
  )

  if (!response.ok) {
    throw new Error(response.statusText || "Request failed")
  }
}
