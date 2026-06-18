"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGetExperiment, apiListExperiments } from "@/lib/release-decision-api";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";

type MetricRole = "Primary" | "Guardrail";

type MetricRow = {
  key: string;
  event: string;
  name: string | null;
  role: MetricRole;
  metricType: string | null;
  metricAgg: string | null;
  direction: string | null;
  description: string | null;
  experiments: { id: string; name: string }[];
  runs: Set<string>;
};

type ParsedMetric = {
  name?: string | null;
  event?: string | null;
  metricType?: string | null;
  metricAgg?: string | null;
  expectedDirection?: string | null;
  direction?: string | null;
  description?: string | null;
  inverse?: boolean | null;
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeEvent(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function metricKey(role: MetricRole, event: string) {
  return `${role}:${event}`;
}

function ensureMetric(
  map: Map<string, MetricRow>,
  role: MetricRole,
  metric: ParsedMetric,
  experiment: { id: string; name: string },
) {
  const event = normalizeEvent(metric.event);
  if (!event) return null;

  const key = metricKey(role, event);
  const existing = map.get(key);
  if (existing) {
    existing.name ||= metric.name ?? null;
    existing.metricType ||= metric.metricType ?? null;
    existing.metricAgg ||= metric.metricAgg ?? null;
    existing.direction ||= metric.expectedDirection ?? metric.direction ?? null;
    existing.description ||= metric.description ?? null;
    if (!existing.experiments.some((item) => item.id === experiment.id)) {
      existing.experiments.push(experiment);
    }
    return existing;
  }

  const row: MetricRow = {
    key,
    event,
    name: metric.name ?? null,
    role,
    metricType: metric.metricType ?? null,
    metricAgg: metric.metricAgg ?? null,
    direction: metric.expectedDirection ?? metric.direction ?? null,
    description: metric.description ?? null,
    experiments: [experiment],
    runs: new Set<string>(),
  };
  map.set(key, row);
  return row;
}

function parseGuardrailEvents(raw: string | null | undefined): ParsedMetric[] {
  if (!raw?.trim()) return [];

  const parsed = parseJson<ParsedMetric[] | string[]>(raw);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) =>
        typeof item === "string" ? { event: item } : item,
      )
      .filter((item) => Boolean(normalizeEvent(item.event)));
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ event: line }));
}

function parseGuardrailDescriptions(raw: string | null | undefined) {
  return parseJson<Record<string, string>>(raw) ?? {};
}

function addExperimentMetrics(
  map: Map<string, MetricRow>,
  experiment: Awaited<ReturnType<typeof apiGetExperiment>>,
) {
  const experimentRef = { id: experiment.id, name: experiment.name };
  const primary = parseJson<ParsedMetric>(experiment.primaryMetric);
  if (primary) {
    ensureMetric(map, "Primary", primary, experimentRef);
  }

  const guardrails = parseJson<ParsedMetric[]>(experiment.guardrails) ?? [];
  for (const guardrail of guardrails) {
    ensureMetric(map, "Guardrail", guardrail, experimentRef);
  }

  for (const run of experiment.experimentRuns ?? []) {
    const runRef = run.runId || run.slug || run.id;
    const primaryRow = ensureMetric(
      map,
      "Primary",
      {
        event: run.primaryMetricEvent,
        metricType: run.primaryMetricType,
        metricAgg: run.primaryMetricAgg,
        description: run.metricDescription,
      },
      experimentRef,
    );
    primaryRow?.runs.add(runRef);

    const descriptions = parseGuardrailDescriptions(run.guardrailDescriptions);
    for (const guardrail of parseGuardrailEvents(run.guardrailEvents)) {
      const event = normalizeEvent(guardrail.event);
      const row = ensureMetric(
        map,
        "Guardrail",
        {
          ...guardrail,
          description: guardrail.description ?? (event ? descriptions[event] : null),
        },
        experimentRef,
      );
      row?.runs.add(runRef);
    }
  }
}

function roleClass(role: MetricRole) {
  return role === "Primary"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

function formatDirection(direction: string | null) {
  switch (direction) {
    case "increase_good":
      return "Higher is better";
    case "decrease_good":
      return "Lower is better";
    case "increase_bad":
      return "Higher is bad";
    case "decrease_bad":
      return "Lower is bad";
    default:
      return "Not set";
  }
}

export function MetricsClient() {
  const { isAuthenticated, projectEnv, sessionStatus } = useAuth();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !projectEnv) {
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiListExperiments(projectEnv.envId, { pageIndex: 0, pageSize: 200 })
      .then(async (page) => {
        const details = await Promise.all(
          (page.items ?? []).map((experiment) =>
            apiGetExperiment(projectEnv.envId, experiment.id),
          ),
        );
        const map = new Map<string, MetricRow>();
        for (const detail of details) {
          addExperimentMetrics(map, detail);
        }
        const rows = Array.from(map.values()).sort((a, b) =>
          a.event.localeCompare(b.event),
        );
        if (!cancelled) setMetrics(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load metrics.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, projectEnv, sessionStatus]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return metrics;
    return metrics.filter((metric) =>
      [
        metric.event,
        metric.name,
        metric.description,
        metric.metricType,
        metric.metricAgg,
        ...metric.experiments.map((experiment) => experiment.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text)),
    );
  }, [metrics, query]);

  return (
    <section className="fb-list-page">
      <div className="fb-table-content">
        <div className="fb-table-search">
          <div className="fb-search-toolbar">
            <div className="fb-left-filters">
              <label className="fb-main-search single">
                <Search className="size-4" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Filter metrics by event, name, or experiment"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="fb-filter-input"
                />
              </label>
              {query.trim() && (
                <button
                  type="button"
                  className="fb-dashed-button active"
                  onClick={() => setQuery("")}
                >
                  <X className="size-3.5" />
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fb-table-wrapper">
          {loading ? (
            <div className="fb-table-state">
              <Loader2 className="size-4 animate-spin" />
              Loading metrics...
            </div>
          ) : error ? (
            <div className="fb-table-state error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="fb-table-state">
              {query.trim()
                ? "No metrics match the current filter."
                : "No metrics recorded yet."}
            </div>
          ) : (
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Aggregation</th>
                  <th>Direction</th>
                  <th>Used by</th>
                  <th>Runs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((metric) => (
                  <tr key={metric.key}>
                    <td className="fb-name-cell">
                      <div className="fb-item-name">{metric.name || metric.event}</div>
                      <div className="fb-code-pill">{metric.event}</div>
                      {metric.description && (
                        <div className="fb-item-meta fb-description">
                          {metric.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`fb-stage-badge ${roleClass(metric.role)}`}>
                        {metric.role}
                      </span>
                    </td>
                    <td>
                      {metric.metricType ? (
                        <span className="fb-muted-text">{metric.metricType}</span>
                      ) : (
                        <span className="fb-muted-text">Not set</span>
                      )}
                    </td>
                    <td>
                      {metric.metricAgg ? (
                        <span className="fb-muted-text">{metric.metricAgg}</span>
                      ) : (
                        <span className="fb-muted-text">Not set</span>
                      )}
                    </td>
                    <td className="fb-last-change">
                      <span>{formatDirection(metric.direction)}</span>
                    </td>
                    <td className="fb-metric-used-by">
                      {metric.experiments.slice(0, 3).map((experiment) => (
                        <Link
                          key={experiment.id}
                          className="fb-action-link"
                          href={`/${experiment.id}`}
                        >
                          {experiment.name}
                        </Link>
                      ))}
                      {metric.experiments.length > 3 && (
                        <span className="fb-muted-text">
                          +{metric.experiments.length - 3} more
                        </span>
                      )}
                    </td>
                    <td className="fb-runs-cell">
                      {metric.runs.size > 0 ? (
                        <span className="fb-run-count">
                          {metric.runs.size} {metric.runs.size === 1 ? "run" : "runs"}
                        </span>
                      ) : (
                        <span className="fb-muted-text">No runs</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
