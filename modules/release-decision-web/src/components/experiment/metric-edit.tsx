import { useEffect, useMemo, useState } from "react";
import { updateMetricsAction } from "@/lib/actions";
import { listMetrics } from "@/lib/release-decision-client-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, X, BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Experiment, Metric } from "@/lib/release-decision-types";

type GuardrailRow = {
  metricKey: string;
  direction: "increase_bad" | "decrease_bad";
};

type ParsedPrimary = {
  event: string;
  expectedDirection: "increase_good" | "decrease_good";
};

const NEW_GUARDRAIL: GuardrailRow = {
  metricKey: "",
  direction: "increase_bad",
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parsePrimaryMetric(value: string | null | undefined): ParsedPrimary {
  const parsed = parseJson<{ event?: string; key?: string; metricKey?: string }>(value);
  return {
    event: parsed?.metricKey ?? parsed?.key ?? parsed?.event ?? "",
    expectedDirection:
      (parsed as { expectedDirection?: string } | null)?.expectedDirection === "decrease_good"
        ? "decrease_good"
        : "increase_good",
  };
}

function parseGuardrailsToRows(value: string | null | undefined): GuardrailRow[] {
  if (!value) return [];
  const parsed = parseJson<Array<Record<string, unknown>> | string[]>(value);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item): GuardrailRow | null => {
        if (typeof item === "string") {
          return { metricKey: item, direction: "increase_bad" };
        }

        const metricKey =
          stringValue(item.metricKey) ??
          stringValue(item.key) ??
          stringValue(item.event) ??
          "";
        if (!metricKey) return null;

        const direction =
          item.direction === "decrease_bad" ? "decrease_bad" : "increase_bad";
        return { metricKey, direction };
      })
      .filter((item): item is GuardrailRow => Boolean(item));
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ metricKey: line, direction: "increase_bad" }));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metricLabel(metric: Metric) {
  return `${metric.name} (${metric.key})`;
}

function metricTypeLabel(metric: Metric) {
  return metric.metricType === "continuous"
    ? `Numeric, ${metric.metricAgg}`
    : "Binary conversion";
}

function MetricDetails({ metric }: { metric: Metric | undefined }) {
  if (!metric) return null;

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{metric.name}</span>
        <span className="fb-code-pill">{metric.key}</span>
        <span className="text-muted-foreground">{metricTypeLabel(metric)}</span>
      </div>
      {metric.description && (
        <p className="mt-1 leading-relaxed text-muted-foreground">
          {metric.description}
        </p>
      )}
    </div>
  );
}

function GuardrailsEditor({
  rows,
  metrics,
  onChange,
}: {
  rows: GuardrailRow[];
  metrics: Metric[];
  onChange: (rows: GuardrailRow[]) => void;
}) {
  function update<K extends keyof GuardrailRow>(
    i: number,
    field: K,
    value: GuardrailRow[K],
  ) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function add() {
    onChange([...rows, { ...NEW_GUARDRAIL }]);
  }

  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  const guardrailPayload = rows
    .filter((row) => row.metricKey)
    .map((row) => ({
      metricKey: row.metricKey,
      direction: row.direction,
    }));

  return (
    <div className="space-y-2">
      <input type="hidden" name="guardrails" value={JSON.stringify(guardrailPayload)} />

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const metric = metrics.find((item) => item.key === row.metricKey);
            return (
              <div key={i} className="relative space-y-2 rounded-md border px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute right-2 top-2 text-muted-foreground/40 transition-colors hover:text-destructive"
                  title="Remove"
                >
                  <X className="size-3" />
                </button>

                <div className="space-y-1 pr-5">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Metric
                  </Label>
                  <select
                    value={row.metricKey}
                    onChange={(event) => update(i, "metricKey", event.target.value)}
                    className={cn(
                      "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                    required
                  >
                    <option value="">Select metric</option>
                    {metrics.map((option) => (
                      <option key={option.id} value={option.key}>
                        {metricLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Alarm If
                  </Label>
                  <select
                    value={row.direction}
                    onChange={(event) =>
                      update(
                        i,
                        "direction",
                        event.target.value === "decrease_bad"
                          ? "decrease_bad"
                          : "increase_bad",
                      )
                    }
                    className={cn(
                      "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                    required
                  >
                    <option value="increase_bad">Increases</option>
                    <option value="decrease_bad">Decreases</option>
                  </select>
                </div>

                <MetricDetails metric={metric} />
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3" />
        Add guardrail
      </button>
    </div>
  );
}

function MetricEditForm({
  experiment,
  onDone,
  onCancel,
}: {
  experiment: Experiment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialPrimary = parsePrimaryMetric(experiment.primaryMetric);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [primaryMetricKey, setPrimaryMetricKey] = useState(initialPrimary.event);
  const [primaryExpectedDirection, setPrimaryExpectedDirection] = useState(initialPrimary.expectedDirection);
  const [guardrails, setGuardrails] = useState<GuardrailRow[]>(() =>
    parseGuardrailsToRows(experiment.guardrails),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listMetrics({ status: "active" })
      .then((items) => {
        if (!cancelled) setMetrics(items);
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
  }, []);

  const activePrimary = useMemo(
    () => metrics.find((metric) => metric.key === primaryMetricKey),
    [metrics, primaryMetricKey],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading metrics...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</div>;
  }

  return (
    <form
      action={async (formData) => {
        await updateMetricsAction(formData);
        onDone();
      }}
      className="space-y-4 pt-1"
    >
      <input type="hidden" name="experimentId" value={experiment.id} />
      <input type="hidden" name="metricKey" value={primaryMetricKey} />
      <input type="hidden" name="expectedDirection" value={primaryExpectedDirection} />

      <fieldset className="space-y-3 rounded-lg border px-3 pb-3 pt-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Primary Metric
        </legend>

        <div className="space-y-1">
          <Label htmlFor="metricKey" className="text-xs">Metric</Label>
          <select
            id="metricKey"
            value={primaryMetricKey}
            onChange={(event) => setPrimaryMetricKey(event.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            required
          >
            <option value="">Select metric</option>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.key}>
                {metricLabel(metric)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="expectedDirection" className="text-xs">Primary Better Direction</Label>
          <select
            id="expectedDirection"
            value={primaryExpectedDirection}
            onChange={(event) =>
              setPrimaryExpectedDirection(
                event.target.value === "decrease_good" ? "decrease_good" : "increase_good",
              )
            }
            className={cn(
              "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            required
          >
            <option value="increase_good">Higher is better</option>
            <option value="decrease_good">Lower is better</option>
          </select>
        </div>

        <MetricDetails metric={activePrimary} />

        {metrics.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Create active metric keys from the Metrics page before configuring an experiment.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border px-3 pb-3 pt-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Guardrails
        </legend>
        <GuardrailsEditor
          rows={guardrails}
          metrics={metrics}
          onChange={setGuardrails}
        />
      </fieldset>

      <DialogFooter className="gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!primaryMetricKey}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MetricEditDialog({ experiment }: { experiment: Experiment }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 text-muted-foreground/50 transition-colors hover:text-foreground"
        title="Edit metrics"
      >
        <Pencil className="size-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Select Experiment Metrics</DialogTitle>
          </DialogHeader>

          {open && (
            <MetricEditForm
              experiment={experiment}
              onDone={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MetricEditPanel({
  experiment,
  onClose,
}: {
  experiment: Experiment;
  onClose: () => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-md border bg-background">
      <div className="border-b px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
            <BarChart3 className="size-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-medium">Select Experiment Metrics</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose registered metric keys for analysis.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <MetricEditForm
          experiment={experiment}
          onDone={onClose}
          onCancel={onClose}
        />
      </div>
    </section>
  );
}
