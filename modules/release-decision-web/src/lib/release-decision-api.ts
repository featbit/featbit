import { getSession } from "@/lib/server-auth/require";
import { bridgeFetch } from "@/lib/server-auth/featbit-bridge";

interface ApiEnvelope<T> {
  success: boolean;
  errors?: string[];
  data?: T;
}

export interface PagedResult<T> {
  totalCount: number;
  items: T[];
}

export interface ReleaseDecisionExperiment {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  flagKey: string | null;
  featBitProjectKey?: string | null;
  featbitProjectKey: string | null;
  featBitEnvId?: string | null;
  featbitEnvId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseDecisionExperimentDetail extends ReleaseDecisionExperiment {
  hypothesis: string | null;
  change: string | null;
  constraints: string | null;
  envSecret: string | null;
  flagServerUrl: string | null;
  goal: string | null;
  guardrails: string | null;
  intent: string | null;
  lastAction: string | null;
  lastLearning: string | null;
  openQuestions: string | null;
  primaryMetric: string | null;
  sandboxStatus: string | null;
  variants: string | null;
  conflictAnalysis: string | null;
  entryMode: string | null;
  experimentRuns: ReleaseDecisionExperimentRun[];
  activities: ReleaseDecisionActivity[];
  messages: ReleaseDecisionMessage[];
  accessToken: string | null;
  sandboxId: string | null;
}

export interface ReleaseDecisionExperimentRun {
  id: string;
  experimentId: string;
  slug: string;
  status: string;
  hypothesis: string | null;
  method: string | null;
  methodReason: string | null;
  primaryMetricEvent: string | null;
  metricDescription: string | null;
  guardrailEvents: string | null;
  guardrailDescriptions: string | null;
  controlVariant: string | null;
  treatmentVariant: string | null;
  trafficAllocation: string | null;
  minimumSample: number | null;
  observationStart: string | null;
  observationEnd: string | null;
  priorProper: boolean;
  priorMean: number | null;
  priorStddev: number | null;
  inputData: string | null;
  analysisResult: string | null;
  decision: string | null;
  decisionSummary: string | null;
  decisionReason: string | null;
  whatChanged: string | null;
  whatHappened: string | null;
  confirmedOrRefuted: string | null;
  whyItHappened: string | null;
  nextHypothesis: string | null;
  runId: string | null;
  primaryMetricAgg: string | null;
  primaryMetricType: string | null;
  trafficPercent: number | null;
  layerId: string | null;
  audienceFilters: string | null;
  trafficOffset: number | null;
  dataSourceMode: string | null;
  customerEndpointConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseDecisionActivity {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  createdAt: string;
}

export interface ReleaseDecisionMessage {
  id: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: string;
}

export type ReleaseDecisionExperimentUpdate = Partial<
  Pick<
    ReleaseDecisionExperimentDetail,
    | "name"
    | "description"
    | "stage"
    | "flagKey"
    | "hypothesis"
    | "accessToken"
    | "change"
    | "constraints"
    | "envSecret"
    | "flagServerUrl"
    | "goal"
    | "intent"
    | "lastAction"
    | "lastLearning"
    | "openQuestions"
    | "sandboxId"
    | "variants"
    | "conflictAnalysis"
    | "entryMode"
  >
> & {
  featbitProjectKey?: string | null;
  featBitProjectKey?: string | null;
};

export type ReleaseDecisionMetricsUpdate = {
  metricName?: string | null;
  metricEvent?: string | null;
  metricType?: string | null;
  metricAgg?: string | null;
  metricDescription?: string | null;
  guardrails?: string | null;
};

export type ReleaseDecisionExperimentRunUpdate =
  Partial<Omit<ReleaseDecisionExperimentRun, "observationStart" | "observationEnd">> & {
    observationStart?: string | Date | null;
    observationEnd?: string | Date | null;
  };

async function apiRequest<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
  } = {},
): Promise<T> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const res = await bridgeFetch(path, {
    method: init.method ?? "GET",
    token: session.token,
    cookies: session.cookies,
    organizationId: session.organizationId,
    workspaceId: session.workspaceId,
    query: init.query,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  let parsed: ApiEnvelope<T> | null = null;
  try {
    parsed = JSON.parse(res.bodyText) as ApiEnvelope<T>;
  } catch {
    // handled below
  }

  if (!res.ok || !parsed?.success) {
    const message = parsed?.errors?.join(", ") || `FeatBit API request failed: ${res.status}`;
    throw new Error(message);
  }

  return parsed.data as T;
}

export function releaseDecisionExperimentsPath(envId: string, suffix = "") {
  return `/envs/${envId}/release-decision/experiments${suffix}`;
}

export async function apiListExperiments(
  envId: string,
  filter: Record<string, string | number | undefined> = {},
) {
  return apiRequest<PagedResult<ReleaseDecisionExperiment>>(
    releaseDecisionExperimentsPath(envId),
    { query: filter },
  );
}

export async function apiGetExperiment(envId: string, id: string) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}`),
  );
}

export async function apiCreateExperiment(
  envId: string,
  body: {
    name: string;
    description?: string | null;
    flagKey?: string | null;
    featbitProjectKey?: string | null;
    featBitProjectKey?: string | null;
  },
) {
  return apiRequest<ReleaseDecisionExperiment>(
    releaseDecisionExperimentsPath(envId),
    { method: "POST", body },
  );
}

export async function apiUpdateExperiment(
  envId: string,
  id: string,
  body: ReleaseDecisionExperimentUpdate,
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}`),
    { method: "PUT", body },
  );
}

export async function apiUpdateExperimentMetrics(
  envId: string,
  id: string,
  body: ReleaseDecisionMetricsUpdate,
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/metrics`),
    { method: "PUT", body },
  );
}

export async function apiDeleteExperiment(envId: string, id: string) {
  return apiRequest<boolean>(
    releaseDecisionExperimentsPath(envId, `/${id}`),
    { method: "DELETE" },
  );
}

export async function apiUpdateExperimentStage(
  envId: string,
  id: string,
  stage: string,
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/stage`),
    { method: "PUT", body: { stage } },
  );
}

export async function apiCreateExperimentRun(envId: string, id: string) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/runs`),
    { method: "POST" },
  );
}

export async function apiDeleteExperimentRun(envId: string, id: string, runId: string) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/runs/${runId}`),
    { method: "DELETE" },
  );
}

export async function apiUpdateExperimentRun(
  envId: string,
  id: string,
  runId: string,
  body: ReleaseDecisionExperimentRunUpdate,
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/runs/${runId}`),
    { method: "PUT", body },
  );
}

export async function apiAnalyzeExperimentRun(
  envId: string,
  id: string,
  runId: string,
  forceFresh?: boolean,
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/runs/${runId}/analyze`),
    { method: "POST", body: { forceFresh: Boolean(forceFresh) } },
  );
}

export async function apiAddMessage(
  envId: string,
  id: string,
  body: { role: string; content: string; metadata?: string | null },
) {
  return apiRequest<ReleaseDecisionExperimentDetail>(
    releaseDecisionExperimentsPath(envId, `/${id}/messages`),
    { method: "POST", body },
  );
}
