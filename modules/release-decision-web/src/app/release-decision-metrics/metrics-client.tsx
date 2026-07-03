import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  archiveMetric,
  createMetric,
  getExperiment,
  listExperiments,
  listMetrics,
  updateMetric,
} from "@/lib/release-decision-client-data";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Archive, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import type { ExperimentDetail } from "@/lib/release-decision-client-data";
import type { Metric } from "@/lib/release-decision-types";

type MetricFormState = {
  id?: string;
  name: string;
  key: string;
  description: string;
  metricType: "binary" | "continuous";
  metricAgg: "once" | "count" | "sum" | "average";
  status: string;
};

type ParsedMetric = {
  event?: string | null;
  key?: string | null;
  metricKey?: string | null;
};

type MetricUsage = {
  experiments: { id: string; name: string; role: string }[];
  runs: Set<string>;
};

const emptyForm: MetricFormState = {
  name: "",
  key: "",
  description: "",
  metricType: "binary",
  metricAgg: "once",
  status: "active",
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeMetricKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function metricToForm(metric: Metric): MetricFormState {
  return {
    id: metric.id,
    name: metric.name,
    key: metric.key,
    description: metric.description ?? "",
    metricType: metric.metricType === "continuous" ? "continuous" : "binary",
    metricAgg:
      metric.metricAgg === "count" ||
      metric.metricAgg === "sum" ||
      metric.metricAgg === "average"
        ? metric.metricAgg
        : "once",
    status: metric.status ?? "active",
  };
}

function metricEvent(value: ParsedMetric | null) {
  return value?.metricKey?.trim() || value?.key?.trim() || value?.event?.trim() || null;
}

function guardrailEvents(raw: string | null | undefined) {
  const parsed = parseJson<Array<ParsedMetric | string>>(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => (typeof item === "string" ? item : metricEvent(item)))
    .filter((item): item is string => Boolean(item));
}

function addUsage(
  map: Map<string, MetricUsage>,
  event: string | null,
  experiment: ExperimentDetail,
  role: string,
  runRef?: string | null,
) {
  if (!event) return;
  const entry = map.get(event) ?? { experiments: [], runs: new Set<string>() };
  if (!entry.experiments.some((item) => item.id === experiment.id)) {
    entry.experiments.push({ id: experiment.id, name: experiment.name, role });
  }
  if (runRef) entry.runs.add(runRef);
  map.set(event, entry);
}

function buildUsage(experiments: ExperimentDetail[]) {
  const map = new Map<string, MetricUsage>();
  for (const experiment of experiments) {
    addUsage(map, metricEvent(parseJson<ParsedMetric>(experiment.primaryMetric)), experiment, "Primary");
    for (const event of guardrailEvents(experiment.guardrails)) {
      addUsage(map, event, experiment, "Guardrail");
    }

    for (const run of experiment.experimentRuns ?? []) {
      const runRef = run.runId || run.slug || run.id;
      addUsage(map, run.primaryMetricEvent, experiment, "Run primary", runRef);
      for (const event of guardrailEvents(run.guardrailEvents)) {
        addUsage(map, event, experiment, "Run guardrail", runRef);
      }
    }
  }
  return map;
}

function metricTypeLabel(metric: Metric) {
  return metric.metricType === "continuous"
    ? `Numeric, ${metric.metricAgg}`
    : "Binary conversion";
}

function statusClass(status: string) {
  return status === "archived"
    ? "bg-muted text-muted-foreground"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
}

export function MetricsClient() {
  const { isAuthenticated, projectEnv, sessionStatus } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [experiments, setExperiments] = useState<ExperimentDetail[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MetricFormState>(emptyForm);

  const load = async (cancelled?: { value: boolean }) => {
    if (!isAuthenticated || !projectEnv) {
      setLoading(sessionStatus === "checking" || sessionStatus === "unknown");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [registeredMetrics, experimentItems] = await Promise.all([
        listMetrics({ status: "" }),
        listExperiments(),
      ]);
      const details = await Promise.all(experimentItems.map((item) => getExperiment(item.id)));
      if (!cancelled?.value) {
        setMetrics(registeredMetrics);
        setExperiments(details);
      }
    } catch (err) {
      if (!cancelled?.value) {
        setError(err instanceof Error ? err.message : "Failed to load metrics.");
      }
    } finally {
      if (!cancelled?.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelled = { value: false };
    void load(cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [isAuthenticated, projectEnv, sessionStatus]);

  const usage = useMemo(() => buildUsage(experiments), [experiments]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return metrics;
    return metrics.filter((metric) =>
      [
        metric.key,
        metric.name,
        metric.description,
        metric.metricType,
        metric.metricAgg,
        metric.status,
        ...(usage.get(metric.key)?.experiments.map((experiment) => experiment.name) ?? []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text)),
    );
  }, [metrics, query, usage]);

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (metric: Metric) => {
    setForm(metricToForm(metric));
    setDialogOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const metricType = form.metricType === "continuous" ? "continuous" : "binary";
      const payload = {
        name: form.name.trim(),
        key: normalizeMetricKey(form.key),
        description: form.description.trim() || null,
        metricType,
        metricAgg: metricType === "binary" ? "once" : form.metricAgg,
        status: form.status,
      };
      if (form.id) {
        await updateMetric(form.id, payload);
      } else {
        await createMetric(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metric.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (metric: Metric) => {
    setSaving(true);
    setError(null);
    try {
      await archiveMetric(metric.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive metric.");
    } finally {
      setSaving(false);
    }
  };

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
                  placeholder="Filter metrics by key, name, or experiment"
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
            <div className="fb-right-actions">
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {metrics.length} metrics
              </span>
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="size-3.5" />
                New metric
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="fb-table-state error">{error}</div>}

        <div className="fb-table-wrapper">
          {loading ? (
            <div className="fb-table-state">
              <Loader2 className="size-4 animate-spin" />
              Loading metrics...
            </div>
          ) : filtered.length === 0 ? (
            <div className="fb-table-state">
              {query.trim()
                ? "No metrics match the current filter."
                : "No metrics registered yet."}
            </div>
          ) : (
            <div className="fb-metrics-grid" role="table" aria-label="Metrics">
              <div className="fb-metrics-header" role="row">
                <div role="columnheader">Metric</div>
                <div role="columnheader">Type</div>
                <div role="columnheader">Status</div>
                <div role="columnheader">Used by</div>
                <div role="columnheader">Runs</div>
                <div role="columnheader" />
              </div>
              <div className="fb-metrics-body" role="rowgroup">
                {filtered.map((metric) => {
                  const metricUsage = usage.get(metric.key);
                  return (
                    <div className="fb-metrics-row" role="row" key={metric.id}>
                      <div className="fb-metrics-metric" role="cell">
                        <div className="fb-metrics-title-line">
                          <span className="fb-item-name">{metric.name}</span>
                          <span className="fb-code-pill">{metric.key}</span>
                        </div>
                        {metric.description && (
                          <div className="fb-item-meta fb-description">
                            {metric.description}
                          </div>
                        )}
                      </div>
                      <div role="cell">
                        <span className="fb-muted-text">{metricTypeLabel(metric)}</span>
                      </div>
                      <div role="cell">
                        <span className={`fb-stage-badge ${statusClass(metric.status)}`}>
                          {metric.status}
                        </span>
                      </div>
                      <div className="fb-metrics-used-by" role="cell">
                        {(metricUsage?.experiments ?? []).slice(0, 3).map((experiment) => (
                          <Link
                            key={experiment.id}
                            className="fb-action-link"
                            href={`/${experiment.id}`}
                          >
                            {experiment.name}
                          </Link>
                        ))}
                        {(metricUsage?.experiments.length ?? 0) > 3 && (
                          <span className="fb-muted-text">
                            +{(metricUsage?.experiments.length ?? 0) - 3} more
                          </span>
                        )}
                        {!metricUsage && <span className="fb-muted-text">Not used</span>}
                      </div>
                      <div className="fb-runs-cell" role="cell">
                        {metricUsage?.runs.size ? (
                          <span className="fb-run-count">
                            {metricUsage.runs.size} {metricUsage.runs.size === 1 ? "run" : "runs"}
                          </span>
                        ) : (
                          <span className="fb-muted-text">No runs</span>
                        )}
                      </div>
                      <div role="cell">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(metric)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {metric.status !== "archived" && (
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => archive(metric)}>
                              <Archive className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Metric" : "New Metric"}</DialogTitle>
              <DialogDescription>
                Metric keys are the stable SDK .track event keys used by experiment analysis.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="metric-name">Name</Label>
                <Input
                  id="metric-name"
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      key: current.id || current.key ? current.key : normalizeMetricKey(name),
                    }));
                  }}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="metric-key">Key</Label>
                <Input
                  id="metric-key"
                  value={form.key}
                  onChange={(event) => setForm((current) => ({ ...current, key: normalizeMetricKey(event.target.value) }))}
                  className="font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="metric-type">Type</Label>
                  <select
                    id="metric-type"
                    value={form.metricType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        metricType: event.target.value === "continuous" ? "continuous" : "binary",
                        metricAgg: event.target.value === "continuous" ? current.metricAgg : "once",
                      }))
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="binary">Binary conversion</option>
                    <option value="continuous">Numeric value</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="metric-agg">Aggregation</Label>
                  <select
                    id="metric-agg"
                    value={form.metricAgg}
                    disabled={form.metricType === "binary"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        metricAgg:
                          event.target.value === "count" ||
                          event.target.value === "sum" ||
                          event.target.value === "average"
                            ? event.target.value
                            : "once",
                      }))
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm disabled:bg-muted/50"
                  >
                    <option value="once">Once per user</option>
                    <option value="count">Count all</option>
                    <option value="sum">Sum values</option>
                    <option value="average">Average values</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="metric-status">Catalog status</Label>
                <select
                  id="metric-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value === "archived" ? "archived" : "active",
                    }))
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Active metrics can be selected by new experiments. Archived metrics remain for historical references.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="metric-description">Description</Label>
                <Textarea
                  id="metric-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
