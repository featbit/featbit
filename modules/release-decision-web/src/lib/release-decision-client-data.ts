import { apiRequest } from "@/lib/featbit-auth/http";
import { authStorage } from "@/lib/featbit-auth/storage";
import type {
  ReleaseDecisionActivity,
  ReleaseDecisionExperiment,
  ReleaseDecisionExperimentDetail,
  ReleaseDecisionExperimentRun,
  ReleaseDecisionExperimentRunUpdate,
  ReleaseDecisionMetricsUpdate,
  ReleaseDecisionMessage,
  PagedResult,
} from "@/lib/release-decision-api";
import type {
  Activity,
  Experiment,
  ExperimentRun,
  Message,
} from "@/generated/prisma";

export type ExperimentDetail = Experiment & {
  experimentRuns: ExperimentRun[];
  activities: Activity[];
  messages: Message[];
};

export const EXPERIMENT_UPDATED_EVENT = "release-decision:experiment-updated";

export function publishExperimentUpdated(experiment: ExperimentDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ExperimentDetail>(EXPERIMENT_UPDATED_EVENT, {
      detail: experiment,
    }),
  );
}

function requireEnvId(): string {
  const envId = authStorage.getProjectEnv()?.envId;
  if (!envId) {
    throw new Error("FeatBit environment is required");
  }
  return envId;
}

function path(envId: string, suffix = "") {
  return `/envs/${envId}/release-decision/experiments${suffix}`;
}

function toDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(0);
  return value instanceof Date ? value : new Date(value);
}

function optionalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function mapExperiment(experiment: ReleaseDecisionExperiment): Experiment {
  return {
    ...experiment,
    featbitProjectKey:
      experiment.featbitProjectKey ?? experiment.featBitProjectKey ?? null,
    featbitEnvId:
      experiment.featbitEnvId ?? experiment.featBitEnvId ?? null,
    createdAt: toDate(experiment.createdAt),
    updatedAt: toDate(experiment.updatedAt),
  } as unknown as Experiment;
}

function mapRun(run: ReleaseDecisionExperimentRun): ExperimentRun {
  return {
    ...run,
    createdAt: toDate(run.createdAt),
    updatedAt: toDate(run.updatedAt),
    observationStart: optionalDate(run.observationStart),
    observationEnd: optionalDate(run.observationEnd),
  } as ExperimentRun;
}

function mapActivity(
  activity: ReleaseDecisionActivity,
  experimentId: string,
): Activity {
  return {
    ...activity,
    experimentId,
    createdAt: toDate(activity.createdAt),
  } as Activity;
}

function mapMessage(
  message: ReleaseDecisionMessage,
  experimentId: string,
): Message {
  return {
    ...message,
    experimentId,
    createdAt: toDate(message.createdAt),
  } as Message;
}

function mapDetail(experiment: ReleaseDecisionExperimentDetail): ExperimentDetail {
  return {
    ...mapExperiment(experiment),
    hypothesis: experiment.hypothesis ?? null,
    accessToken: experiment.accessToken ?? null,
    change: experiment.change ?? null,
    constraints: experiment.constraints ?? null,
    envSecret: experiment.envSecret ?? null,
    flagServerUrl: experiment.flagServerUrl ?? null,
    goal: experiment.goal ?? null,
    guardrails: experiment.guardrails ?? null,
    intent: experiment.intent ?? null,
    lastAction: experiment.lastAction ?? null,
    lastLearning: experiment.lastLearning ?? null,
    openQuestions: experiment.openQuestions ?? null,
    primaryMetric: experiment.primaryMetric ?? null,
    sandboxStatus: experiment.sandboxStatus ?? null,
    sandboxId: experiment.sandboxId ?? null,
    variants: experiment.variants ?? null,
    conflictAnalysis: experiment.conflictAnalysis ?? null,
    entryMode: experiment.entryMode ?? null,
    experimentRuns: (experiment.experimentRuns ?? []).map(mapRun),
    activities: (experiment.activities ?? []).map((activity) =>
      mapActivity(activity, experiment.id),
    ),
    messages: (experiment.messages ?? []).map((message) =>
      mapMessage(message, experiment.id),
    ),
  } as ExperimentDetail;
}

export async function listExperiments(filter: {
  name?: string;
  stage?: string;
  flagKey?: string;
} = {}) {
  const envId = requireEnvId();
  const page = await apiRequest<PagedResult<ReleaseDecisionExperiment>>(
    path(envId),
    {
      method: "GET",
      query: {
        pageIndex: 0,
        pageSize: 200,
        name: filter.name?.trim() || undefined,
        stage: filter.stage?.trim() || undefined,
        flagKey: filter.flagKey?.trim() || undefined,
      },
    },
  );

  return (page.items ?? []).map(mapExperiment);
}

export async function getExperiment(id: string) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${id}`),
    { method: "GET" },
  );

  return mapDetail(experiment);
}

export async function createExperiment(data: {
  name: string;
  description?: string | null;
  featbitProjectKey?: string | null;
}) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperiment>(path(envId), {
    method: "POST",
    body: data,
  });

  return mapExperiment(experiment);
}

export async function updateExperiment(
  id: string,
  data: Record<string, unknown>,
) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${id}`),
    { method: "PUT", body: data },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function updateExperimentStage(id: string, stage: string) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${id}/stage`),
    { method: "PUT", body: { stage } },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function updateExperimentMetrics(
  id: string,
  data: ReleaseDecisionMetricsUpdate,
) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${id}/metrics`),
    { method: "PUT", body: data },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function deleteExperiment(id: string) {
  const envId = requireEnvId();
  await apiRequest<boolean>(path(envId, `/${id}`), {
    method: "DELETE",
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(EXPERIMENT_UPDATED_EVENT, {
        detail: null,
      }),
    );
  }
}

export async function createExperimentRun(experimentId: string) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${experimentId}/runs`),
    { method: "POST" },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function updateExperimentRun(
  experimentId: string,
  runId: string,
  data: ReleaseDecisionExperimentRunUpdate,
) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${experimentId}/runs/${runId}`),
    { method: "PUT", body: data },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function deleteExperimentRun(experimentId: string, runId: string) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${experimentId}/runs/${runId}`),
    { method: "DELETE" },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function analyzeExperimentRun(
  experimentId: string,
  runId: string,
  forceFresh?: boolean,
) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${experimentId}/runs/${runId}/analyze`),
    { method: "POST", body: { forceFresh: Boolean(forceFresh) } },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}

export async function addMessage(
  experimentId: string,
  data: { role: string; content: string; metadata?: string | null },
) {
  const envId = requireEnvId();
  const experiment = await apiRequest<ReleaseDecisionExperimentDetail>(
    path(envId, `/${experimentId}/messages`),
    { method: "POST", body: data },
  );

  const detail = mapDetail(experiment);
  publishExperimentUpdated(detail);
  return detail;
}
