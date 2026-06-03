"use client";

import { useState } from "react";
import { updateMetricsAction } from "@/lib/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, X, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Experiment } from "@/generated/prisma";

/* ── Types ── */
type GuardrailRow = {
  name: string;
  event: string;
  metricType: "binary" | "continuous";
  metricAgg: "once" | "count" | "sum" | "average";
  direction: "increase_bad" | "decrease_bad";
  description: string;
};

const NEW_GUARDRAIL: GuardrailRow = {
  name: "",
  event: "",
  metricType: "binary",
  metricAgg: "once",
  direction: "increase_bad",
  description: "",
};

/* ── Parse primaryMetric from JSON or plain text ── */
function parsePrimaryMetric(value: string | null | undefined) {
  if (!value) {
    return { name: "", event: "", metricType: "binary", metricAgg: "once", description: "" };
  }
  try {
    const p = JSON.parse(value);
    if (p && typeof p === "object") {
      // Back-compat: legacy "numeric" rows surface as canonical "continuous".
      const metricType =
        p.metricType === "continuous" || p.metricType === "numeric"
          ? "continuous"
          : "binary";
      return {
        name: p.name ?? "",
        event: p.event ?? "",
        metricType,
        metricAgg: p.metricAgg ?? "once",
        description: p.description ?? "",
      };
    }
  } catch { /* plain text */ }
  return { name: value, event: "", metricType: "binary", metricAgg: "once", description: "" };
}

/* ── Parse guardrails from JSON array or legacy free text ── */
function parseGuardrailsToRows(value: string | null | undefined): GuardrailRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((g): GuardrailRow => ({
        name: g.name ?? g.event ?? "",
        event: g.event ?? g.name ?? "",
        // Back-compat: legacy "numeric" rows surface as the canonical "continuous".
        metricType:
          g.metricType === "continuous" || g.metricType === "numeric"
            ? "continuous"
            : "binary",
        metricAgg:
          g.metricAgg === "count"
            ? "count"
            : g.metricAgg === "sum"
              ? "sum"
              : g.metricAgg === "average"
                ? "average"
                : "once",
        // `inverse:true` from older data → decrease_bad (higher is worse
        // means we actually want lower, so increase is bad). Keep simple.
        direction:
          g.direction === "decrease_bad" || g.inverse === false
            ? "decrease_bad"
            : "increase_bad",
        description: g.description ?? "",
      }));
    }
  } catch { /* free text */ }
  // Legacy free-text: "event_name — description" (one per line)
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): GuardrailRow => {
      const match = line.match(/^(.+?)\s*[—–-]+\s*(.+)$/);
      const name = match ? match[1].trim() : line;
      return {
        ...NEW_GUARDRAIL,
        name,
        event: name,
        description: match ? match[2].trim() : "",
      };
    });
}

/* ── Styled native select ── */
function NativeSelect({
  id,
  name,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
        "transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      {children}
    </select>
  );
}

/* ── Dynamic guardrails editor ── */
function GuardrailsEditor({ initialRows }: { initialRows: GuardrailRow[] }) {
  const [rows, setRows] = useState<GuardrailRow[]>(initialRows);

  function update<K extends keyof GuardrailRow>(
    i: number,
    field: K,
    value: GuardrailRow[K],
  ) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  }

  function add() {
    setRows((prev) => [...prev, { ...NEW_GUARDRAIL }]);
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {/* Hidden input carries the JSON to the server action */}
      <input type="hidden" name="guardrails" value={JSON.stringify(rows)} />

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-md border px-2.5 py-2 space-y-2 relative">
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-2 right-2 text-muted-foreground/40 hover:text-destructive transition-colors"
                title="Remove"
              >
                <X className="size-3" />
              </button>

              <div className="space-y-1 pr-5">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Metric Name
                </Label>
                <Input
                  value={row.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                  placeholder="e.g. Checkout abandonment"
                  className="text-xs h-7"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Event Name
                </Label>
                <Input
                  value={row.event}
                  onChange={(e) => update(i, "event", e.target.value)}
                  placeholder="e.g. checkout_abandoned"
                  className="text-xs font-mono h-7"
                />
                <p className="text-[10px] text-muted-foreground/70">
                  The event key tracked in your application.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Metric Type
                  </Label>
                  <select
                    value={row.metricType}
                    onChange={(e) =>
                      update(i, "metricType", e.target.value as GuardrailRow["metricType"])
                    }
                    className={cn(
                      "h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                  >
                    <option value="binary">Binary</option>
                    <option value="continuous">Numeric</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Aggregation
                  </Label>
                  <select
                    value={row.metricAgg}
                    onChange={(e) =>
                      update(i, "metricAgg", e.target.value as GuardrailRow["metricAgg"])
                    }
                    className={cn(
                      "h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                  >
                    <option value="once">Once per user</option>
                    <option value="count">Count all</option>
                    <option value="sum">Sum values</option>
                    <option value="average">Average values</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    Alarm If
                  </Label>
                  <select
                    value={row.direction}
                    onChange={(e) =>
                      update(i, "direction", e.target.value as GuardrailRow["direction"])
                    }
                    className={cn(
                      "h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                    title="Which direction counts as a regression"
                  >
                    <option value="increase_bad">↑ Increases</option>
                    <option value="decrease_bad">↓ Decreases</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Description{" "}
                  <span className="text-muted-foreground/60 normal-case">(optional)</span>
                </Label>
                <Textarea
                  value={row.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  placeholder="e.g. Streamlined flow must not confuse users"
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3" />
        Add guardrail
      </button>
    </div>
  );
}

/* ── Metric edit form (mounts fresh each time dialog opens) ── */
function MetricEditForm({
  experiment,
  onDone,
  onCancel,
}: {
  experiment: Experiment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const metric = parsePrimaryMetric(experiment.primaryMetric);
  const guardrailRows = parseGuardrailsToRows(experiment.guardrails);

  return (
    <form
      action={async (formData) => {
        await updateMetricsAction(formData);
        onDone();
      }}
      className="space-y-4 pt-1"
    >
      <input type="hidden" name="experimentId" value={experiment.id} />

      {/* ── Primary Metric ── */}
      <fieldset className="space-y-3 rounded-lg border px-3 pb-3 pt-2">
        <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Primary Metric
        </legend>

        <div className="space-y-1">
          <Label htmlFor="metricName" className="text-xs">Metric Name</Label>
          <Input
            id="metricName"
            name="metricName"
            defaultValue={metric.name}
            placeholder="e.g. Checkout completion rate"
            className="text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="metricEvent" className="text-xs">Event Name</Label>
          <Input
            id="metricEvent"
            name="metricEvent"
            defaultValue={metric.event}
            placeholder="e.g. purchase_completed"
            className="text-sm font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            The event key tracked in your application
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="metricType" className="text-xs">Metric Type</Label>
            <NativeSelect id="metricType" name="metricType" defaultValue={metric.metricType}>
              <option value="binary">Binary (conversion)</option>
              <option value="continuous">Numeric (value)</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="metricAgg" className="text-xs">Aggregation</Label>
            <NativeSelect id="metricAgg" name="metricAgg" defaultValue={metric.metricAgg}>
              <option value="once">Once per user</option>
              <option value="count">Count all</option>
              <option value="sum">Sum values</option>
              <option value="average">Average values</option>
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="metricDescription" className="text-xs">
            Description{" "}
            <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <Textarea
            id="metricDescription"
            name="metricDescription"
            defaultValue={metric.description}
            placeholder="What does this metric measure and why does it matter?"
            rows={2}
            className="text-xs resize-none"
          />
        </div>
      </fieldset>

      {/* ── Guardrails ── */}
      <fieldset className="space-y-2 rounded-lg border px-3 pb-3 pt-2">
        <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Guardrails
        </legend>
        <p className="text-[10px] text-muted-foreground">
          Metrics that must not regress for this experiment to ship.
        </p>
        <GuardrailsEditor initialRows={guardrailRows} />
      </fieldset>

      <DialogFooter className="gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">Save</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Pencil button + structured dialog for editing Primary Metric and Guardrails.
 * @deprecated Kept for legacy import compatibility — new flows should use
 * MetricEditPanel via a parent state toggle (same pattern as FlagIntegrationPanel).
 */
export function MetricEditDialog({ experiment }: { experiment: Experiment }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Edit metrics"
      >
        <Pencil className="size-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Experiment Metrics</DialogTitle>
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

/**
 * Inline panel version — replaces stage content while editing metrics. Parent
 * controls open/close state; close button returns user to the summary view.
 * Mirrors the FlagIntegrationPanel UX so Measure / chat panel on the right
 * stays visible.
 */
export function MetricEditPanel({
  experiment,
  onClose,
}: {
  experiment: Experiment;
  onClose: () => void;
}) {
  return (
    <section className="flex flex-col h-full min-h-0 rounded-md border bg-background">
      {/* Header */}
      <div className="border-b px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="size-9 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <BarChart3 className="size-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium">Edit Experiment Metrics</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the primary success metric and guardrails. These drive how
              runs are analyzed.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <MetricEditForm
          experiment={experiment}
          onDone={onClose}
          onCancel={onClose}
        />
      </div>
    </section>
  );
}
