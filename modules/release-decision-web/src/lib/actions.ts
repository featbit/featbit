import {
  createExperiment,
  createExperimentRun as createExperimentRunAndReturnExperiment,
  deleteExperiment,
  deleteExperimentRun,
  getExperiment,
  updateExperiment,
  updateExperimentMetrics,
  updateExperimentRun,
  updateExperimentStage,
} from "@/lib/release-decision-client-data";

async function addActivity(
  _experimentId: string,
  _data: { type: string; title: string; detail?: string },
) {
  return null;
}

async function createExperimentRun(experimentId: string) {
  const experiment = await createExperimentRunAndReturnExperiment(experimentId);
  return [...experiment.experimentRuns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0] ?? null;
}

export async function createExperimentAction(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const featbitProjectKey = formData.get("featbitProjectKey") as string | null;

  if (!name || name.trim().length === 0) {
    throw new Error("Experiment name is required");
  }

  const experiment = await createExperiment({
    name: name.trim(),
    description: description?.trim() || undefined,
    featbitProjectKey: featbitProjectKey?.trim() || null,
  });

  return;
}

export async function deleteExperimentAction(id: string) {
  await deleteExperiment(id);
  return;
}

export async function updateFlagConfigAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const flagKey = formData.get("flagKey") as string | null;
  const envSecret = formData.get("envSecret") as string | null;
  const accessToken = formData.get("accessToken") as string | null;
  const flagServerUrl = formData.get("flagServerUrl") as string | null;
  const featbitProjectKey = formData.get("featbitProjectKey") as string | null;
  const featbitEnvId = formData.get("featbitEnvId") as string | null;
  // variants arrives as a JSON string serialised by the client
  const variants = formData.get("variants") as string | null;

  await updateExperiment(experimentId, {
    flagKey: flagKey?.trim() || null,
    envSecret: envSecret?.trim() || null,
    accessToken: accessToken?.trim() || null,
    flagServerUrl: flagServerUrl?.trim() || null,
    featbitProjectKey: featbitProjectKey?.trim() || null,
    featbitEnvId: featbitEnvId?.trim() || null,
    variants: variants?.trim() || null,
  });

  await addActivity(experimentId, {
    type: "note",
    title: "Feature flag configuration updated",
  });

  return;
}

export async function bindFeatbitFlagAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const flagKey = formData.get("flagKey") as string;
  const featbitEnvId = formData.get("featbitEnvId") as string;
  const featbitProjectKey = formData.get("featbitProjectKey") as string | null;
  const variants = formData.get("variants") as string | null;

  if (!experimentId || !flagKey || !featbitEnvId) {
    throw new Error("experimentId, flagKey and featbitEnvId are required");
  }

  await updateExperiment(experimentId, {
    flagKey: flagKey.trim(),
    featbitEnvId: featbitEnvId.trim(),
    featbitProjectKey: featbitProjectKey?.trim() || null,
    variants: variants?.trim() || null,
  });

  await addActivity(experimentId, {
    type: "note",
    title: `Connected feature flag ${flagKey}`,
  });

  return;
}

export async function updateMetricsAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const metricName = (formData.get("metricName") as string | null)?.trim() || null;
  const metricEvent = (formData.get("metricEvent") as string | null)?.trim() || null;
  const metricType = (formData.get("metricType") as string | null)?.trim() || "binary";
  const metricAgg = (formData.get("metricAgg") as string | null)?.trim() || "once";
  const expectedDirectionValue = (formData.get("expectedDirection") as string | null)?.trim();
  const expectedDirection =
    expectedDirectionValue === "decrease_good" ? "decrease_good" : "increase_good";
  const metricDescription = (formData.get("metricDescription") as string | null)?.trim() || null;
  // guardrails arrives as a JSON string serialised by the client
  const guardrails = formData.get("guardrails") as string | null;

  const guardrailsJson = guardrails?.trim() || null;

  await updateExperimentMetrics(experimentId, {
    metricName,
    metricEvent,
    metricType,
    metricAgg,
    expectedDirection,
    metricDescription,
    guardrails: guardrailsJson,
  });

  await addActivity(experimentId, {
    type: "note",
    title: "Experiment metrics updated",
  });

  return;
}

export async function updateDecisionStateAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const description = formData.get("description") as string | null;
  const goal = formData.get("goal") as string | null;
  const intent = formData.get("intent") as string | null;
  const hypothesis = formData.get("hypothesis") as string | null;
  const change = formData.get("change") as string | null;
  const constraints = formData.get("constraints") as string | null;

  const data: Record<string, string | null> = {};
  if (formData.has("description")) data.description = description?.trim() || null;
  if (formData.has("goal")) data.goal = goal?.trim() || null;
  if (formData.has("intent")) data.intent = intent?.trim() || null;
  if (formData.has("hypothesis")) data.hypothesis = hypothesis?.trim() || null;
  if (formData.has("change")) data.change = change?.trim() || null;
  if (formData.has("constraints")) data.constraints = constraints?.trim() || null;

  await updateExperiment(experimentId, data);

  await addActivity(experimentId, {
    type: "note",
    title: "Decision state updated",
  });

  return;
}

export async function advanceStageAction(experimentId: string, stage: string) {
  await updateExperimentStage(experimentId, stage);
  return;
}

export async function updateExperimentRunAudienceAction(formData: FormData) {
  const experimentRunId = formData.get("experimentRunId") as string;
  const experimentId = formData.get("experimentId") as string;
  const trafficPercentRaw = formData.get("trafficPercent") as string;
  const trafficOffsetRaw = formData.get("trafficOffset") as string;
  const layerId = formData.get("layerId") as string | null;
  const layerKey = formData.get("layerKey") as string | null;
  const allocationKeySelector = formData.get("allocationKeySelector") as string | null;
  const assignmentUnitSelector = formData.get("assignmentUnitSelector") as string | null;
  const layerTrafficPercentRaw = formData.get("layerTrafficPercent") as string | null;
  const analysisSamplingPlan = formData.get("analysisSamplingPlan") as string | null;
  const sliceStartRaw = formData.get("sliceStart") as string | null;
  const sliceEndRaw = formData.get("sliceEnd") as string | null;
  const allocationPlan = formData.get("allocationPlan") as string | null;
  const audienceFilters = formData.get("audienceFilters") as string | null;
  const methodRaw = formData.get("method") as string | null;
  const controlVariant = formData.get("controlVariant") as string | null;
  const treatmentVariant = formData.get("treatmentVariant") as string | null;

  const trafficPercent = parseFloat(trafficPercentRaw);
  const trafficOffset = parseInt(trafficOffsetRaw, 10);
  const sliceStart = parseFloat(sliceStartRaw ?? "");
  const sliceEnd = parseFloat(sliceEndRaw ?? "");
  const layerTrafficPercent = parseFloat(layerTrafficPercentRaw ?? "");
  const method = methodRaw === "bandit" ? "bandit" : "bayesian_ab";
  const update: Record<string, unknown> = {
    layerId: layerId?.trim() || null,
    layerKey: layerKey?.trim() || layerId?.trim() || null,
    allocationKeySelector: allocationKeySelector?.trim() || "user.keyId",
    assignmentUnitSelector:
      assignmentUnitSelector?.trim() || allocationKeySelector?.trim() || "user.keyId",
    layerTrafficPercent: isNaN(layerTrafficPercent)
      ? 100
      : Math.min(100, Math.max(0.000001, layerTrafficPercent)),
    allocationPlan: allocationPlan?.trim() || null,
    analysisSamplingPlan: analysisSamplingPlan?.trim() || null,
    audienceFilters: audienceFilters?.trim() || null,
    method,
    controlVariant: controlVariant?.trim() || null,
    treatmentVariant: treatmentVariant?.trim() || null,
  };

  if (formData.has("trafficPercent")) {
    update.trafficPercent = isNaN(trafficPercent) ? 100 : Math.min(100, Math.max(1, trafficPercent));
  }
  if (formData.has("trafficOffset")) {
    update.trafficOffset = isNaN(trafficOffset) ? 0 : Math.min(99, Math.max(0, trafficOffset));
  }
  if (formData.has("sliceStart")) {
    update.sliceStart = isNaN(sliceStart) ? 0 : Math.min(100, Math.max(0, sliceStart));
  }
  if (formData.has("sliceEnd")) {
    update.sliceEnd = isNaN(sliceEnd) ? 100 : Math.min(100, Math.max(0, sliceEnd));
  }

  await updateExperimentRun(experimentId, experimentRunId, update);

  await addActivity(experimentId, {
    type: "note",
    title: "Experiment run audience & traffic updated",
  });

  return;
}

export async function deleteExperimentRunAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const experimentRunId = formData.get("experimentRunId") as string;
  if (!experimentId || !experimentRunId)
    throw new Error("experimentId and experimentRunId are required");

  const experiment = await getExperiment(experimentId);
  const run = experiment?.experimentRuns.find((item) => item.id === experimentRunId);
  await deleteExperimentRun(experimentId, experimentRunId);

  await addActivity(experimentId, {
    type: "note",
    title: `Experiment run deleted${run ? `: ${run.slug}` : ""}`,
  });

  return;
}

export async function createNewExperimentRunAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const methodRaw = formData.get("method") as string | null;
  const controlVariant = formData.get("controlVariant") as string | null;
  const treatmentVariant = formData.get("treatmentVariant") as string | null;
  if (!experimentId) throw new Error("experimentId is required");

  const newRun = await createExperimentRun(experimentId);
  const method = methodRaw === "bandit" ? "bandit" : "bayesian_ab";

  if (newRun?.id) {
    await updateExperimentRun(experimentId, newRun.id, {
      method,
      controlVariant: controlVariant?.trim() || null,
      treatmentVariant: treatmentVariant?.trim() || null,
    });
  }

  return { runId: newRun?.id, slug: newRun?.slug, method };
}

export async function updateExperimentRunObservationWindowAction(
  formData: FormData,
) {
  const experimentRunId = formData.get("experimentRunId") as string;
  const experimentId = formData.get("experimentId") as string;
  const startRaw = (formData.get("observationStart") as string | null)?.trim();
  const endRaw = (formData.get("observationEnd") as string | null)?.trim();

  if (!experimentRunId) throw new Error("experimentRunId is required");

  const toDate = (s: string | null | undefined) =>
    s && !isNaN(new Date(s).getTime()) ? new Date(s) : null;

  await updateExperimentRun(experimentId, experimentRunId, {
    observationStart: toDate(startRaw),
    observationEnd: toDate(endRaw),
  });

  if (experimentId) {
    await addActivity(experimentId, {
      type: "note",
      title: "Observation window updated",
      detail:
        startRaw || endRaw
          ? `From ${startRaw || "—"} to ${endRaw || "—"}`
          : "Cleared",
    });
    return;
  }
}

