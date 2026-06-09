import { cookies } from "next/headers";
import {
  apiAddMessage,
  apiCreateExperiment,
  apiCreateExperimentRun,
  apiDeleteExperiment,
  apiDeleteExperimentRun,
  apiGetExperiment,
  apiListExperiments,
  apiUpdateExperiment,
  apiUpdateExperimentMetrics,
  apiUpdateExperimentRun,
  apiUpdateExperimentStage,
  type ReleaseDecisionActivity,
  type ReleaseDecisionExperimentDetail,
  type ReleaseDecisionExperimentRun,
  type ReleaseDecisionExperimentRunUpdate,
  type ReleaseDecisionMetricsUpdate,
} from "@/lib/release-decision-api";

const ENV_COOKIE_NAME = "fb_env_id";

type DateLike<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

type ExperimentRun = DateLike<
  Omit<ReleaseDecisionExperimentRun, "observationStart" | "observationEnd">
> & {
  observationStart: Date | null;
  observationEnd: Date | null;
};

type Activity = Omit<ReleaseDecisionActivity, "createdAt"> & {
  experimentId: string;
  createdAt: Date;
};

type Message = {
  id: string;
  experimentId: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: Date;
};

type ExperimentDetail = DateLike<
  Omit<ReleaseDecisionExperimentDetail, "experimentRuns" | "activities" | "messages">
> & {
  experimentRuns: ExperimentRun[];
  activities: Activity[];
  messages: Message[];
};

export async function getCurrentEnvId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ENV_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function mapRun(run: ReleaseDecisionExperimentRun): ExperimentRun {
  return {
    ...run,
    createdAt: toDate(run.createdAt) ?? new Date(0),
    updatedAt: toDate(run.updatedAt) ?? new Date(0),
    observationStart: toDate(run.observationStart),
    observationEnd: toDate(run.observationEnd),
  };
}

function mapDetail(experiment: ReleaseDecisionExperimentDetail): ExperimentDetail {
  return {
    ...experiment,
    featbitProjectKey: experiment.featbitProjectKey ?? experiment.featBitProjectKey ?? null,
    featbitEnvId: experiment.featbitEnvId ?? experiment.featBitEnvId ?? null,
    createdAt: toDate(experiment.createdAt) ?? new Date(0),
    updatedAt: toDate(experiment.updatedAt) ?? new Date(0),
    experimentRuns: (experiment.experimentRuns ?? []).map(mapRun),
    activities: (experiment.activities ?? []).map((activity) => ({
      ...activity,
      experimentId: experiment.id,
      createdAt: toDate(activity.createdAt) ?? new Date(0),
    })),
    messages: (experiment.messages ?? []).map((message) => ({
      ...message,
      experimentId: experiment.id,
      createdAt: toDate(message.createdAt) ?? new Date(0),
    })),
  };
}

async function requireEnvId(): Promise<string> {
  const envId = await getCurrentEnvId();
  if (!envId) {
    throw new Error("FeatBit environment is required");
  }
  return envId;
}

function findRun(experiment: ExperimentDetail, runId: string): ExperimentRun | null {
  return experiment.experimentRuns.find((run) => run.id === runId) ?? null;
}

export async function getExperiments() {
  const envId = await getCurrentEnvId();
  if (!envId) return [];

  const page = await apiListExperiments(envId, { pageIndex: 0, pageSize: 200 });
  return (page.items ?? []).map((experiment) => ({
    ...experiment,
    featbitProjectKey: experiment.featbitProjectKey ?? experiment.featBitProjectKey ?? null,
    featbitEnvId: experiment.featbitEnvId ?? experiment.featBitEnvId ?? null,
    createdAt: toDate(experiment.createdAt) ?? new Date(0),
    updatedAt: toDate(experiment.updatedAt) ?? new Date(0),
  }));
}

export async function getExperiment(id: string) {
  const envId = await requireEnvId();
  return mapDetail(await apiGetExperiment(envId, id));
}

export async function createExperiment(data: {
  name: string;
  description?: string;
  featbitProjectKey?: string | null;
}) {
  const envId = await requireEnvId();
  const experiment = await apiCreateExperiment(envId, {
    name: data.name,
    description: data.description,
    featbitProjectKey: data.featbitProjectKey,
  });

  return {
    ...experiment,
    featbitProjectKey: experiment.featbitProjectKey ?? experiment.featBitProjectKey ?? null,
    featbitEnvId: experiment.featbitEnvId ?? experiment.featBitEnvId ?? null,
    createdAt: toDate(experiment.createdAt) ?? new Date(0),
    updatedAt: toDate(experiment.updatedAt) ?? new Date(0),
  };
}

export async function updateExperiment(
  id: string,
  data: Record<string, unknown>,
) {
  const envId = await requireEnvId();
  const current = await apiGetExperiment(envId, id);
  return mapDetail(await apiUpdateExperiment(envId, id, {
    name: current.name,
    description: current.description,
    stage: current.stage,
    flagKey: current.flagKey,
    hypothesis: current.hypothesis,
    change: current.change,
    constraints: current.constraints,
    envSecret: current.envSecret,
    flagServerUrl: current.flagServerUrl,
    goal: current.goal,
    intent: current.intent,
    lastAction: current.lastAction,
    lastLearning: current.lastLearning,
    openQuestions: current.openQuestions,
    variants: current.variants,
    conflictAnalysis: current.conflictAnalysis,
    entryMode: current.entryMode,
    ...data,
  }));
}

export async function updateExperimentMetrics(
  id: string,
  data: ReleaseDecisionMetricsUpdate,
) {
  const envId = await requireEnvId();
  return mapDetail(await apiUpdateExperimentMetrics(envId, id, data));
}

export async function deleteExperiment(id: string) {
  const envId = await requireEnvId();
  await apiDeleteExperiment(envId, id);
}

export async function updateExperimentStage(id: string, stage: string) {
  const envId = await requireEnvId();
  return mapDetail(await apiUpdateExperimentStage(envId, id, stage));
}

export async function createExperimentRun(experimentId: string) {
  const envId = await requireEnvId();
  const experiment = mapDetail(await apiCreateExperimentRun(envId, experimentId));
  return experiment.experimentRuns[0];
}

export async function updateExperimentRun(
  experimentId: string,
  id: string,
  data: ReleaseDecisionExperimentRunUpdate,
) {
  const envId = await requireEnvId();
  const experiment = mapDetail(await apiUpdateExperimentRun(envId, experimentId, id, data));
  return findRun(experiment, id);
}

export async function deleteExperimentRun(experimentId: string, id: string) {
  const envId = await requireEnvId();
  return mapDetail(await apiDeleteExperimentRun(envId, experimentId, id));
}

export async function addActivity(
  _experimentId: string,
  _data: { type: string; title: string; detail?: string },
) {
  // Activities are created by FeatBit API writes. A standalone activity endpoint
  // can be added later if the UI needs explicit note-only rows.
  return null;
}

export async function getMessages(experimentId: string) {
  const experiment = await getExperiment(experimentId);
  return experiment.messages;
}

export async function getMessagesAfter(experimentId: string, after: Date | null) {
  const messages = await getMessages(experimentId);
  return after
    ? messages.filter((message) => message.createdAt.getTime() > after.getTime())
    : messages;
}

export async function addMessage(
  experimentId: string,
  data: { role: string; content: string; metadata?: string },
) {
  const envId = await requireEnvId();
  const experiment = mapDetail(await apiAddMessage(envId, experimentId, data));
  return experiment.messages[experiment.messages.length - 1];
}

export async function getRunningExperimentRuns() {
  const experiments = await getExperiments();
  const details = await Promise.all(experiments.map((experiment) => getExperiment(experiment.id)));
  return details.flatMap((experiment) =>
    experiment.experimentRuns
      .filter((run) => ["draft", "collecting", "analyzing"].includes(run.status))
      .map((run) => ({
        ...run,
        experiment: {
          id: experiment.id,
          flagKey: experiment.flagKey,
          envSecret: experiment.envSecret,
        },
      })),
  );
}

