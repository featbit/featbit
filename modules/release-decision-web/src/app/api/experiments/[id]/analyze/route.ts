import { NextRequest, NextResponse } from "next/server";
import { FEATBIT_API_V1 } from "@/lib/featbit-auth/config";
import { runAnalysis } from "@/lib/stats/analyze";
import { runBanditAnalysis } from "@/lib/stats/bandit";

interface ApiEnvelope<T> {
  success: boolean;
  errors?: string[];
  data?: T;
}

interface ReleaseDecisionExperimentDetail {
  id?: string;
  name?: string | null;
  flagKey?: string | null;
  experimentRuns?: Array<{
    id: string;
    status?: string | null;
    method?: string | null;
    primaryMetricEvent?: string | null;
    guardrailEvents?: string | null;
    controlVariant?: string | null;
    treatmentVariant?: string | null;
    minimumSample?: number | null;
    observationStart?: string | null;
    observationEnd?: string | null;
    priorProper?: boolean | null;
    priorMean?: number | null;
    priorStddev?: number | null;
    primaryMetricAgg?: string | null;
    inputData?: string | null;
    analysisResult?: string | null;
  }>;
}

interface GuardrailDefinition {
  event: string;
  metricType?: string;
  metricAgg?: string;
  inverse?: boolean;
}

interface ExperimentStats {
  variants?: Array<{
    variant?: string | null;
    users?: number | null;
    conversions?: number | null;
    sumValue?: number | null;
    sumSquares?: number | null;
  }>;
}

function parseMetrics(inputData?: string | null) {
  if (!inputData) return null;

  try {
    const parsed = JSON.parse(inputData) as {
      metrics?: Record<string, Record<string, unknown>>;
    };
    return parsed.metrics && typeof parsed.metrics === "object"
      ? parsed.metrics
      : null;
  } catch {
    return null;
  }
}

function parseGuardrails(value?: string | null): GuardrailDefinition[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") return { event: item };
        if (!item || typeof item !== "object") return null;

        const record = item as Record<string, unknown>;
        const event = typeof record.event === "string"
          ? record.event
          : typeof record.name === "string"
            ? record.name
            : null;

        return event
          ? {
              event,
              metricType: typeof record.metricType === "string" ? record.metricType : undefined,
              metricAgg: typeof record.metricAgg === "string" ? record.metricAgg : undefined,
              inverse: typeof record.inverse === "boolean" ? record.inverse : undefined,
            }
          : null;
      })
      .filter((item): item is GuardrailDefinition => item !== null);
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((event) => ({ event }));
  }
}

function normalizeMetricType(value?: string) {
  return value === "continuous" || value === "numeric" ? "continuous" : "binary";
}

function normalizeMetricAgg(value?: string) {
  return value === "count" || value === "sum" || value === "average" ? value : "once";
}

function toDateOnly(value: string | null | undefined, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  return date.toISOString().slice(0, 10);
}

function statsToMetricData(metricType: string, stats: ExperimentStats) {
  const metricData: Record<string, Record<string, number>> = {};

  for (const row of stats.variants ?? []) {
    if (!row.variant) continue;

    metricData[row.variant] = metricType === "binary"
      ? {
          n: row.users ?? 0,
          k: row.conversions ?? 0,
        }
      : {
          n: row.users ?? 0,
          sum: row.sumValue ?? 0,
          sum_squares: row.sumSquares ?? 0,
        };
  }

  return metricData;
}

async function addGuardrailMetrics(
  envId: string,
  experiment: ReleaseDecisionExperimentDetail,
  run: NonNullable<ReleaseDecisionExperimentDetail["experimentRuns"]>[number],
  apiHeaders: Record<string, string>,
) {
  const guardrails = parseGuardrails(run.guardrailEvents);
  if (guardrails.length === 0 || !experiment.flagKey) {
    return run.inputData ?? null;
  }

  const metrics = parseMetrics(run.inputData) ?? {};
  const now = new Date();
  const startDate = toDateOnly(run.observationStart, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const endDate = toDateOnly(run.observationEnd, now);

  for (const guardrail of guardrails) {
    const metricType = normalizeMetricType(guardrail.metricType);
    const metricAgg = normalizeMetricAgg(guardrail.metricAgg);
    const response = await fetch(
      `${FEATBIT_API_V1}/envs/${envId}/experiment-stats/query`,
      {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          flagKey: experiment.flagKey,
          metricEvent: guardrail.event,
          startDate,
          endDate,
          metricType,
          metricAgg,
        }),
      },
    );

    const parsed = (await response.json()) as ApiEnvelope<ExperimentStats>;
    if (!response.ok || parsed.success === false) {
      throw new Error(parsed.errors?.join(", ") || `Guardrail stats failed: ${guardrail.event}`);
    }

    metrics[guardrail.event] = statsToMetricData(metricType, parsed.data ?? {});
  }

  return JSON.stringify({ metrics });
}

function buildStructuredAnalysis(
  experimentId: string,
  experiment: ReleaseDecisionExperimentDetail,
  run: NonNullable<ReleaseDecisionExperimentDetail["experimentRuns"]>[number],
) {
  const metrics = parseMetrics(run.inputData);
  if (!metrics) return null;

  const metricEvent = run.primaryMetricEvent;
  if (!metricEvent) return null;

  const control = run.controlVariant || "control";
  const treatments = (run.treatmentVariant || "treatment")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (treatments.length === 0) return null;

  const common = {
    slug: experiment.name || experimentId,
    metrics,
    control,
    treatments,
    observationStart: run.observationStart ?? undefined,
    observationEnd: run.observationEnd ?? undefined,
    priorProper: Boolean(run.priorProper),
    priorMean: run.priorMean ?? undefined,
    priorStddev: run.priorStddev ?? undefined,
  };

  if (run.method === "bandit") {
    return runBanditAnalysis({
      ...common,
      metricEvent,
    });
  }

  return runAnalysis({
    ...common,
    minimumSample: run.minimumSample ?? 0,
    primaryMetricAgg: run.primaryMetricAgg ?? undefined,
    guardrails: parseGuardrails(run.guardrailEvents),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: experimentId } = await params;
  const body = await req.json();
  const { envId, runId, forceFresh } = body as {
    envId?: string;
    runId?: string;
    forceFresh?: boolean;
  };

  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!envId) {
    return NextResponse.json(
      { error: "FeatBit environment is required" },
      { status: 400 },
    );
  }

  if (!runId) {
    return NextResponse.json(
      { error: "runId is required" },
      { status: 400 },
    );
  }

  try {
    const apiHeaders = {
      Authorization: authorization,
      Organization: req.headers.get("organization") ?? "",
      Workspace: req.headers.get("workspace") ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const apiResponse = await fetch(
      `${FEATBIT_API_V1}/envs/${envId}/release-decision/experiments/${experimentId}/runs/${runId}/analyze`,
      {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ forceFresh: Boolean(forceFresh) }),
      },
    );

    const parsed = (await apiResponse.json()) as ApiEnvelope<ReleaseDecisionExperimentDetail>;
    if (!apiResponse.ok || parsed.success === false) {
      return NextResponse.json(
        { error: parsed.errors?.join(", ") || "Analyze failed" },
        { status: apiResponse.status },
      );
    }

    const run = parsed.data?.experimentRuns?.find((item) => item.id === runId);
    const inputData = run && parsed.data
      ? await addGuardrailMetrics(envId, parsed.data, run, apiHeaders)
      : run?.inputData ?? null;
    const analysisRun = run ? { ...run, inputData } : null;
    const structuredAnalysis = analysisRun && parsed.data
      ? buildStructuredAnalysis(experimentId, parsed.data, analysisRun)
      : null;

    if (analysisRun && structuredAnalysis) {
      const structuredJson = JSON.stringify(structuredAnalysis);
      const updateResponse = await fetch(
        `${FEATBIT_API_V1}/envs/${envId}/release-decision/experiments/${experimentId}/runs/${runId}`,
        {
          method: "PUT",
          headers: apiHeaders,
          body: JSON.stringify({
            inputData,
            analysisResult: structuredJson,
            status: "analyzing",
          }),
        },
      );

      const updated = (await updateResponse.json()) as ApiEnvelope<ReleaseDecisionExperimentDetail>;
      if (!updateResponse.ok || updated.success === false) {
        return NextResponse.json(
          { error: updated.errors?.join(", ") || "Analyze result save failed" },
          { status: updateResponse.status },
        );
      }

      const updatedRun = updated.data?.experimentRuns?.find((item) => item.id === runId) ?? analysisRun;

      return NextResponse.json({
        inputData: updatedRun.inputData ?? inputData,
        analysisResult: updatedRun.analysisResult ?? structuredJson,
        dataSource: "featbit-api",
      });
    }

    return NextResponse.json({
      inputData: run?.inputData ?? null,
      analysisResult: run?.analysisResult ?? null,
      dataSource: "featbit-api",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analyze failed" },
      { status: 503 },
    );
  }
}
