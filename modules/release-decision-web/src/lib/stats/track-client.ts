/**
 * track-service HTTP client.
 *
 * Queries track-service's /api/query/experiment endpoint to get per-variant
 * aggregated stats from ClickHouse, then converts the response into the
 * metrics dict format that runAnalysis() / runBanditAnalysis() expect.
 */

import { signEnvSecret } from "@/lib/track/env-secret";

const TRACK_SERVICE_URL =
  process.env.TRACK_SERVICE_URL ?? "https://track.featbit.ai";

const TIMEOUT_MS = Number(process.env.TRACK_TIMEOUT_MS ?? 10000);

// ── Track-service response shape ──────────────────────────────────────────────

interface TrackVariantStats {
  variant: string;
  users: number;
  conversions: number;
  sumValue: number;
  sumSquares: number;
  conversionRate: number;
  avgValue: number;
}

interface TrackQueryResponse {
  envId: string;
  flagKey: string;
  metricEvent: string;
  window: { start: string; end: string };
  variants: TrackVariantStats[];
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface QueryParams {
  envId: string;
  flagKey: string;
  metricEvent: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  /**
   * Canonical "binary" | "continuous". Required — picks the response shape
   * (`{n,k}` for binary, `{n,sum,sum_squares}` for continuous). Track-service
   * also receives this and uses it to choose the per-user SQL contribution.
   */
  metricType: "binary" | "continuous";
  /**
   * Canonical "once" | "count" | "sum" | "average". Required. Track-service
   * uses this to pick the per-user contribution column (binary=once,
   * continuous=count|sum|average).
   */
  metricAgg: "once" | "count" | "sum" | "average";
}

/**
 * Query one metric event from track-service and return a per-variant data dict
 * in the shape expected by runAnalysis():
 *
 *   binary     → { "control": { n: 1000, k: 150 }, ... }
 *   continuous → { "control": { n: 1000, sum: 5000, sum_squares: 27500 }, ... }
 *
 * Shape is decided by `metricType` — the caller's declaration is the single
 * source of truth. Run rows always carry `primaryMetricType` (DB default
 * `binary`) and guardrails always go through parseGuardrailDefs, so the
 * declaration is always present at this boundary.
 *
 * Returns null if the query fails or no data is found.
 */
export async function queryMetric(
  params: QueryParams,
): Promise<Record<string, Record<string, number>> | null> {
  try {
    const resp = await fetch(`${TRACK_SERVICE_URL}/api/query/experiment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Signed env secret — track-service resolves envId from this token.
        // Falls back to raw envId when TRACK_SERVICE_SIGNING_KEY is unset.
        Authorization: signEnvSecret(params.envId),
      },
      body: JSON.stringify({
        flagKey:     params.flagKey,
        metricEvent: params.metricEvent,
        startDate:   params.startDate,
        endDate:     params.endDate,
        metricType:  params.metricType,
        metricAgg:   params.metricAgg,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) {
      console.warn(
        `[track-client] query failed: ${resp.status} ${resp.statusText}`,
      );
      return null;
    }

    const data = (await resp.json()) as TrackQueryResponse;
    // Success with zero rows is NOT the same as a query failure.
    // Return an empty object so callers can distinguish "no data yet" from
    // "track-service unreachable" (which returns null via the catch below).
    if (!data.variants || data.variants.length === 0) return {};

    const isContinuous = params.metricType === "continuous";
    const result: Record<string, Record<string, number>> = {};
    for (const v of data.variants) {
      result[v.variant] = isContinuous
        ? { n: v.users, sum: v.sumValue, sum_squares: v.sumSquares }
        : { n: v.users, k: v.conversions };
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[track-client] query error: ${message}`);
    return null;
  }
}

/**
 * Per-event spec consumed by queryAllMetrics. Carries the user's declared
 * metricType / metricAgg so each query honours the right SQL aggregation
 * (track-service side) and response shape (track-client side).
 */
export interface MetricSpec {
  event: string;
  metricType: "binary" | "continuous";
  metricAgg: "once" | "count" | "sum" | "average";
}

/**
 * Query primary metric + guardrails in parallel and return the full metrics
 * dict ready for runAnalysis():
 *
 *   {
 *     "checkout":    { "control": {n, k}, "treatment": {n, k} },
 *     "error_rate":  { "control": {n, k}, "treatment": {n, k}, "inverse": true },
 *   }
 *
 * Each MetricSpec must carry its declared metricType + metricAgg.
 */
export async function queryAllMetrics(params: {
  envId: string;
  flagKey: string;
  startDate: string;
  endDate: string;
  primary: MetricSpec;
  guardrails?: MetricSpec[];
}): Promise<Record<string, Record<string, unknown>> | null> {
  const specs: MetricSpec[] = [params.primary, ...(params.guardrails ?? [])];

  const results = await Promise.all(
    specs.map((spec) =>
      queryMetric({
        envId:       params.envId,
        flagKey:     params.flagKey,
        metricEvent: spec.event,
        startDate:   params.startDate,
        endDate:     params.endDate,
        metricType:  spec.metricType,
        metricAgg:   spec.metricAgg,
      }),
    ),
  );

  // Primary metric is required
  if (!results[0]) return null;

  const metrics: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < specs.length; i++) {
    if (results[i]) {
      metrics[specs[i].event] = results[i] as Record<string, unknown>;
    }
  }

  return metrics;
}
