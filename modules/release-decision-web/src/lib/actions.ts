import {
  createExperiment,
  createExperimentRun as createExperimentRunAndReturnExperiment,
  deleteExperiment,
  deleteExperimentRun,
  getExperiment,
  updateExperiment,
  updateExperimentRun,
  updateExperimentStage,
  type ExperimentDetail,
} from "@/lib/release-decision-client-data";
import {
  type ReleaseDecisionExperimentRunUpdate,
} from "@/lib/release-decision-api";

async function addActivity(
  _experimentId: string,
  _data: { type: string; title: string; detail?: string },
) {
  return null;
}

async function createExperimentRun(experimentId: string) {
  const experiment = await createExperimentRunAndReturnExperiment(experimentId);
  return experiment.experimentRuns[0] ?? null;
}

function normalizeMetricType(value: unknown): "binary" | "continuous" {
  return value === "continuous" || value === "numeric" ? "continuous" : "binary";
}

function normalizeMetricAgg(value: unknown): "once" | "count" | "sum" | "average" {
  return value === "count" || value === "sum" || value === "average" ? value : "once";
}

function parseGuardrailDefs(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return { event: item, metricType: "binary", metricAgg: "once", inverse: false };
        }
        const metricType = item.metricType === "numeric" ? "continuous" : (item.metricType ?? "binary");
        return {
          event: item.event ?? "",
          metricType,
          metricAgg: item.metricAgg ?? "once",
          inverse: item.inverse ?? item.direction === "increase_bad",
        };
      })
      .filter((g) => g.event);
  } catch {
    return [];
  }
}

async function propagateMetricsToLatestRun(
  experimentId: string,
  fields: { primaryMetric?: string | null; guardrails?: string | null },
) {
  const experiment: ExperimentDetail = await getExperiment(experimentId);
  const run = experiment.experimentRuns[0];
  if (!run) return null;

  const update: ReleaseDecisionExperimentRunUpdate = {};

  if (fields.primaryMetric !== undefined) {
    try {
      const parsed = fields.primaryMetric ? JSON.parse(fields.primaryMetric) : null;
      if (parsed && typeof parsed === "object" && parsed.event) {
        update.primaryMetricEvent = parsed.event;
        update.primaryMetricType = normalizeMetricType(parsed.metricType);
        update.primaryMetricAgg = normalizeMetricAgg(parsed.metricAgg);
        if (parsed.description) update.metricDescription = parsed.description;
      }
    } catch {
      // ignore malformed legacy JSON
    }
  }

  if (fields.guardrails !== undefined) {
    const defs = parseGuardrailDefs(fields.guardrails);
    update.guardrailEvents = defs.length > 0 ? JSON.stringify(defs) : null;
  }

  if (Object.keys(update).length === 0) return run;
  const next = await updateExperimentRun(experimentId, run.id, update);
  return next.experimentRuns.find((item) => item.id === run.id) ?? null;
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
  const metricDescription = (formData.get("metricDescription") as string | null)?.trim() || null;
  // guardrails arrives as a JSON string serialised by the client
  const guardrails = formData.get("guardrails") as string | null;

  const primaryMetric =
    metricName || metricEvent
      ? JSON.stringify({
          ...(metricName && { name: metricName }),
          ...(metricEvent && { event: metricEvent }),
          metricType,
          metricAgg,
          ...(metricDescription && { description: metricDescription }),
        })
      : null;

  const guardrailsJson = guardrails?.trim() || null;

  await updateExperiment(experimentId, {
    primaryMetric,
    guardrails: guardrailsJson,
  });

  // The analysis API reads metric type/agg from the ExperimentRun row, not
  // the Experiment row — so editing metrics here MUST also update the run.
  // Otherwise the next analyze call uses stale or empty type/agg fields.
  await propagateMetricsToLatestRun(experimentId, {
    primaryMetric,
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
  const primaryMetric = formData.get("primaryMetric") as string | null;
  const guardrails = formData.get("guardrails") as string | null;

  const data: Record<string, string | null> = {};
  if (formData.has("description")) data.description = description?.trim() || null;
  if (formData.has("goal")) data.goal = goal?.trim() || null;
  if (formData.has("intent")) data.intent = intent?.trim() || null;
  if (formData.has("hypothesis")) data.hypothesis = hypothesis?.trim() || null;
  if (formData.has("change")) data.change = change?.trim() || null;
  if (formData.has("constraints")) data.constraints = constraints?.trim() || null;
  if (formData.has("primaryMetric")) data.primaryMetric = primaryMetric?.trim() || null;
  if (formData.has("guardrails")) data.guardrails = guardrails?.trim() || null;

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
  const audienceFilters = formData.get("audienceFilters") as string | null;
  const methodRaw = formData.get("method") as string | null;

  const trafficPercent = parseFloat(trafficPercentRaw);
  const trafficOffset = parseInt(trafficOffsetRaw, 10);
  const method = methodRaw === "bandit" ? "bandit" : "bayesian_ab";

  await updateExperimentRun(experimentId, experimentRunId, {
    trafficPercent: isNaN(trafficPercent) ? 100 : Math.min(100, Math.max(1, trafficPercent)),
    trafficOffset: isNaN(trafficOffset) ? 0 : Math.min(99, Math.max(0, trafficOffset)),
    layerId: layerId?.trim() || null,
    audienceFilters: audienceFilters?.trim() || null,
    method,
  });

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
  if (!experimentId) throw new Error("experimentId is required");

  const newRun = await createExperimentRun(experimentId);

  return;
  return { runId: newRun?.id, slug: newRun?.slug };
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

/**
 * Pick "guided" (Codex-assisted) or "expert" (self-configured) entry mode for a new
 * experiment. Called from the entry-mode picker; expert mode records the
 * selection only after the wizard is submitted via saveExpertSetupAction.
 */
export async function selectEntryModeAction(
  experimentId: string,
  mode: "guided" | "expert",
) {
  if (mode !== "guided" && mode !== "expert") {
    throw new Error("Invalid entryMode");
  }
  await updateExperiment(experimentId, { entryMode: mode });
  await addActivity(experimentId, {
    type: "stage_change",
    title: mode === "guided" ? "Started guided Codex setup" : "Started expert setup",
  });
  return;
}

/**
 * Persist the expert-setup wizard in one transaction:
 *   - Experiment.primaryMetric, guardrails, entryMode='expert', stage bump.
 *   - Upserts a single ExperimentRun carrying method/priors/minSample/data.
 *
 * Re-running this action (when the user clicks "Edit setup") updates the
 * same run in place via experimentRunId.
 */
export async function saveExpertSetupAction(formData: FormData) {
  const experimentId = formData.get("experimentId") as string;
  const existingRunId = (formData.get("experimentRunId") as string | null)?.trim() || null;

  const methodRaw = (formData.get("method") as string | null)?.trim();
  const method = methodRaw === "bandit" ? "bandit" : "bayesian_ab";

  const metricName = (formData.get("metricName") as string | null)?.trim() || null;
  const metricEvent = (formData.get("metricEvent") as string | null)?.trim() || null;
  const metricType = (formData.get("metricType") as string | null)?.trim() || "binary";
  const metricAgg = (formData.get("metricAgg") as string | null)?.trim() || "once";
  const metricDescription = (formData.get("metricDescription") as string | null)?.trim() || null;
  const primaryInverse = formData.get("primaryInverse") != null; // checkbox presence
  const primaryDataSourceRaw = (formData.get("primaryDataSource") as string | null)?.trim();
  const primaryDataSource =
    primaryDataSourceRaw === "featbit" || primaryDataSourceRaw === "external"
      ? primaryDataSourceRaw
      : "manual";
  const primaryDataSourceNote = (formData.get("primaryDataSourceNote") as string | null)?.trim() || null;
  const guardrailsRaw = (formData.get("guardrails") as string | null) ?? "[]";
  const priorMode = (formData.get("priorMode") as string | null)?.trim() || "flat";
  const priorMeanRaw = (formData.get("priorMean") as string | null)?.trim();
  const priorStddevRaw = (formData.get("priorStddev") as string | null)?.trim();
  const minimumSampleRaw = (formData.get("minimumSample") as string | null)?.trim();
  const observationStartRaw = (formData.get("observationStart") as string | null)?.trim();
  const observationEndRaw = (formData.get("observationEnd") as string | null)?.trim();

  // Project-level data source (from the Data source wizard step). Validated
  // against the closed set the analyse route understands; anything else
  // collapses to the default. customerEndpointConfig is opaque JSON validated
  // by the fetcher at analyse time, so we only do shape-level checks here.
  const dataSourceModeRaw = (formData.get("dataSourceMode") as string | null)?.trim();
  const dataSourceMode =
    dataSourceModeRaw === "customer-single" ||
    dataSourceModeRaw === "customer-per-metric" ||
    dataSourceModeRaw === "manual" ||
    dataSourceModeRaw === "external-text"
      ? dataSourceModeRaw
      : "featbit-managed";
  const customerEndpointConfigRaw = (formData.get("customerEndpointConfig") as string | null)?.trim() || null;
  const customerEndpointConfig =
    (dataSourceMode === "customer-single" || dataSourceMode === "customer-per-metric") &&
    customerEndpointConfigRaw
      ? customerEndpointConfigRaw
      : null;

  const controlVariant = (formData.get("controlVariant") as string | null)?.trim() || "control";
  const treatmentVariant = (formData.get("treatmentVariant") as string | null)?.trim() || "treatment";
  const dataRowsRaw = (formData.get("dataRows") as string | null) ?? "[]";

  if (!metricEvent) {
    throw new Error("Primary metric event is required");
  }

  // ── Normalise primary metric (Experiment.primaryMetric JSON) ─────────────
  const primaryMetric = JSON.stringify({
    ...(metricName && { name: metricName }),
    event: metricEvent,
    metricType,
    metricAgg,
    ...(metricDescription && { description: metricDescription }),
    ...(primaryInverse && { inverse: true }),
    ...(primaryDataSource !== "manual" && { dataSource: primaryDataSource }),
    ...(primaryDataSource === "external" && primaryDataSourceNote && { dataSourceNote: primaryDataSourceNote }),
  });

  // ── Normalise guardrails (Experiment.guardrails JSON for UI, plus a list
  //    of event names for the ExperimentRun). Also keep observed data per
  //    guardrail so it can be merged into inputData.metrics below. ──────────
  type GuardrailDataRowIn = { variant?: string; n?: string; s?: string; ss?: string };
  type GuardrailIn = {
    name?: string;
    event?: string;
    description?: string;
    inverse?: boolean;
    metricType?: string;
    metricAgg?: string;
    dataRows?: GuardrailDataRowIn[];
    dataSource?: string;
    dataSourceNote?: string;
  };
  type GuardrailParsed = {
    name: string;
    event: string;
    description: string;
    inverse: boolean;
    metricType: string;
    metricAgg: string;
    dataRows: GuardrailDataRowIn[];
    dataSource: "manual" | "featbit" | "external";
    dataSourceNote: string;
  };
  let guardrailsForExperiment: string | null = null;
  let guardrailEventsJson: string | null = null;
  let guardrailDescriptions: Record<string, string> = {};
  let cleanedGuardrails: GuardrailParsed[] = [];
  try {
    const parsed = JSON.parse(guardrailsRaw) as GuardrailIn[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      cleanedGuardrails = parsed
        .map((g) => {
          // Canonical metricType: "binary" | "continuous" (legacy "numeric" tolerated).
          const metricType =
            g.metricType === "continuous" || g.metricType === "numeric"
              ? "continuous"
              : "binary";
          // Binary guardrails always aggregate "once per user"; continuous picks
          // count / sum / average. Anything else falls back to "once".
          const aggIn = g.metricAgg ?? "once";
          const metricAgg =
            metricType === "binary"
              ? "once"
              : aggIn === "count" || aggIn === "sum" || aggIn === "average"
                ? aggIn
                : "sum";
          return {
            name: g.name?.trim() || "",
            event: g.event?.trim() || g.name?.trim() || "",
            description: g.description?.trim() || "",
            inverse: Boolean(g.inverse),
            metricType,
            metricAgg,
            dataRows: Array.isArray(g.dataRows) ? g.dataRows : [],
            dataSource:
              g.dataSource === "featbit" || g.dataSource === "external"
                ? (g.dataSource as "featbit" | "external")
                : ("manual" as const),
            dataSourceNote: g.dataSourceNote?.trim() || "",
          };
        })
        .filter((g) => g.name || g.event);
      if (cleanedGuardrails.length > 0) {
        // Strip dataRows from the UI-facing JSON — dataRows get merged into
        // inputData.metrics instead. Keep dataSource so the wizard re-prefills.
        guardrailsForExperiment = JSON.stringify(
          cleanedGuardrails.map(({ dataRows, dataSource, dataSourceNote, ...rest }) => {
            void dataRows;
            return {
              ...rest,
              ...(dataSource !== "manual" && { dataSource }),
              ...(dataSource === "external" && dataSourceNote && { dataSourceNote }),
            };
          }),
        );
        // Run-side guardrailEvents now stores the rich GuardrailDef[] shape
        // (event, metricType, metricAgg, inverse) so the analysis route can
        // honour type/agg/inverse without re-reading the experiment row.
        guardrailEventsJson = JSON.stringify(
          cleanedGuardrails
            .filter((g) => g.event)
            .map((g) => ({
              event: g.event,
              metricType: g.metricType,
              metricAgg: g.metricAgg,
              inverse: g.inverse,
            })),
        );
        guardrailDescriptions = cleanedGuardrails.reduce<Record<string, string>>((acc, g) => {
          if (g.event && g.description) acc[g.event] = g.description;
          return acc;
        }, {});
      }
    }
  } catch {/* ignore */}

  // ── Priors & minimum sample ──────────────────────────────────────────────
  const priorProper = priorMode === "proper";
  const priorMean =
    priorProper && priorMeanRaw && !isNaN(parseFloat(priorMeanRaw))
      ? parseFloat(priorMeanRaw)
      : null;
  const priorStddev =
    priorProper && priorStddevRaw && !isNaN(parseFloat(priorStddevRaw))
      ? parseFloat(priorStddevRaw)
      : null;
  const minimumSample =
    minimumSampleRaw && !isNaN(parseInt(minimumSampleRaw, 10))
      ? Math.max(0, parseInt(minimumSampleRaw, 10))
      : null;

  // ── Observed data → inputData JSON in the shape runAnalysis() expects ────
  //   metrics[event] = { [variant]: {n,k} | {n,sum,sum_squares}, inverse? }
  type DataRowIn = { variant?: string; n?: string; s?: string; ss?: string };
  function buildVariantMap(
    rows: DataRowIn[] | undefined | null,
    type: string,
  ): Record<string, unknown> | null {
    if (!Array.isArray(rows)) return null;
    const variantMap: Record<string, unknown> = {};
    for (const r of rows) {
      const variant = r.variant?.trim();
      const n = r.n != null && r.n !== "" ? Number(r.n) : NaN;
      const s = r.s != null && r.s !== "" ? Number(r.s) : NaN;
      const ss = r.ss != null && r.ss !== "" ? Number(r.ss) : NaN;
      if (!variant || isNaN(n) || n <= 0) continue;
      if (type === "binary") {
        variantMap[variant] = { n, k: isNaN(s) ? 0 : s };
      } else {
        variantMap[variant] = {
          n,
          sum: isNaN(s) ? 0 : s,
          sum_squares: isNaN(ss) ? 0 : ss,
        };
      }
    }
    return Object.keys(variantMap).length > 0 ? variantMap : null;
  }

  let inputData: string | null = null;
  try {
    const metrics: Record<string, unknown> = {};
    if (primaryDataSource === "manual") {
      const rows = JSON.parse(dataRowsRaw) as DataRowIn[];
      const primaryMap = buildVariantMap(rows, metricType);
      if (primaryMap) {
        if (primaryInverse) primaryMap.inverse = true;
        metrics[metricEvent] = primaryMap;
      }
    }
    // Merge guardrail data — only for manual-source guardrails
    for (const g of cleanedGuardrails) {
      if (!g.event || g.dataSource !== "manual") continue;
      const gMap = buildVariantMap(g.dataRows, g.metricType);
      if (!gMap) continue;
      if (g.inverse) gMap.inverse = true;
      metrics[g.event] = gMap;
    }
    if (Object.keys(metrics).length > 0) {
      inputData = JSON.stringify({ metrics });
    }
  } catch {/* ignore */}

  // ── Parse observation window dates (yyyy-mm-dd) ─────────────────────────
  const observationStart =
    observationStartRaw && !isNaN(new Date(observationStartRaw).getTime())
      ? new Date(observationStartRaw)
      : null;
  const observationEnd =
    observationEndRaw && !isNaN(new Date(observationEndRaw).getTime())
      ? new Date(observationEndRaw)
      : null;

  // ── Persist ──────────────────────────────────────────────────────────────
  await updateExperiment(experimentId, {
    primaryMetric,
    guardrails: guardrailsForExperiment,
    entryMode: "expert",
    stage: inputData ? "measuring" : "implementing",
  });

  const runFields = {
    method,
    primaryMetricEvent: metricEvent,
    metricDescription,
    guardrailEvents: guardrailEventsJson,
    guardrailDescriptions: Object.keys(guardrailDescriptions).length > 0
      ? JSON.stringify(guardrailDescriptions)
      : null,
    controlVariant,
    treatmentVariant,
    priorProper,
    priorMean,
    priorStddev,
    minimumSample,
    inputData,
    primaryMetricType: metricType,
    primaryMetricAgg: metricAgg,
    observationStart,
    observationEnd,
    dataSourceMode,
    customerEndpointConfig,
    status: inputData ? "analyzing" : "draft",
  };

  if (existingRunId) {
    await updateExperimentRun(experimentId, existingRunId, runFields);
  } else {
    const experiment = await getExperiment(experimentId);
    const existing = experiment.experimentRuns[experiment.experimentRuns.length - 1];
    if (existing) {
      await updateExperimentRun(experimentId, existing.id, runFields);
    } else {
      const created = await createExperimentRun(experimentId);
      if (created) {
        await updateExperimentRun(experimentId, created.id, runFields);
      }
    }
  }

  await addActivity(experimentId, {
    type: "note",
    title: "Expert setup saved",
    detail: `method=${method} · metric=${metricEvent}${inputData ? " · data provided" : ""}`,
  });

  return;
}
