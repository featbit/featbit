"use client";

import { useState, type FormEvent } from "react";
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
import { Plus, X, Beaker, Target, ShieldCheck, Sigma, Database, Calendar, HelpCircle, Cable } from "lucide-react";
import { DataSourceStepContent, type DataSourceMode } from "./data-source-step";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { cn } from "@/lib/utils";
import { saveExpertSetupAction } from "@/lib/actions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Experiment, ExperimentRun } from "@/generated/prisma";

/* ── Tooltip question-mark used inline next to a field label ── */
function FieldHelp({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="inline-flex cursor-help text-muted-foreground/50 hover:text-foreground focus:text-foreground transition-colors outline-none"
          >
            <HelpCircle className="size-3" />
          </span>
        }
      />
      <TooltipContent side="top" className="max-w-xs">
        {/* Single block child so the parent's inline-flex+gap doesn't turn each
            text node and <br/> into its own column. */}
        <div className="text-left leading-snug whitespace-normal [&_b]:font-semibold [&_code]:font-mono [&_code]:text-[0.95em]">
          {children}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Label + inline help — keeps the (?) right next to the text ── */
function LabelWithHelp({
  htmlFor,
  label,
  help,
  className,
}: {
  htmlFor?: string;
  label: string;
  help: React.ReactNode;
  className?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn("flex items-center gap-1", className)}>
      {label}
      <FieldHelp>{help}</FieldHelp>
    </Label>
  );
}

/* ── Types ── */
type DataSource = "manual" | "featbit" | "external";
type GuardrailRow = {
  name: string;
  event: string;
  description: string;
  inverse: boolean;
  metricType: string;          // "binary" | "continuous"
  metricAgg: string;           // "once" | "count" | "sum" | "average"
  dataRows: DataRow[];         // observed data per variant (optional)
  dataSource: DataSource;      // where the numbers come from
  dataSourceNote: string;      // free-text for "external"
};
type DataRow = { variant: string; n: string; s: string; ss: string };

function asDataSource(v: unknown): DataSource {
  return v === "featbit" || v === "external" ? v : "manual";
}

/**
 * Force `metricAgg` to a value that's valid for the given `metricType`.
 * - binary     → only "once" makes sense (yes/no per user)
 * - continuous → "count" / "sum" / "average" (per-user pre-aggregation choice);
 *                "once" doesn't apply
 */
function coerceAggForType(agg: string, type: string): string {
  if (type === "binary") return "once";
  // continuous
  if (agg === "count" || agg === "sum" || agg === "average") return agg;
  return "sum";
}

/** Normalise legacy "numeric" rows → canonical "continuous". */
function normalizeMetricType(value: unknown): "binary" | "continuous" {
  return value === "continuous" || value === "numeric" ? "continuous" : "binary";
}

/* ── Parse helpers: reuse logic from metric-edit and analyze route ── */
function parsePrimaryMetric(value: string | null | undefined) {
  if (!value) return {
    name: "", event: "", metricType: "binary", metricAgg: "once", description: "", inverse: false,
    dataSource: "manual" as DataSource, dataSourceNote: "",
  };
  try {
    const p = JSON.parse(value);
    if (p && typeof p === "object") {
      const metricType = normalizeMetricType(p.metricType);
      return {
        name: p.name ?? "",
        event: p.event ?? "",
        metricType,
        metricAgg: coerceAggForType(p.metricAgg ?? "once", metricType),
        description: p.description ?? "",
        inverse: Boolean(p.inverse),
        dataSource: asDataSource(p.dataSource),
        dataSourceNote: p.dataSourceNote ?? "",
      };
    }
  } catch {/* ignore */}
  return {
    name: value, event: "", metricType: "binary", metricAgg: "once", description: "", inverse: false,
    dataSource: "manual" as DataSource, dataSourceNote: "",
  };
}

function parseGuardrails(value: string | null | undefined): GuardrailRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((g) => {
        const metricType = normalizeMetricType(g.metricType);
        return {
        name: g.name ?? g.event ?? "",
        event: g.event ?? "",
        description: g.description ?? "",
        inverse: Boolean(g.inverse),
        metricType,
        metricAgg: coerceAggForType(g.metricAgg ?? "once", metricType),
        dataRows: Array.isArray(g.dataRows)
          ? g.dataRows.map((r: Partial<DataRow>) => ({
              variant: r.variant ?? "",
              n: r.n ?? "",
              s: r.s ?? "",
              ss: r.ss ?? "",
            }))
          : [],
        dataSource: asDataSource(g.dataSource),
        dataSourceNote: g.dataSourceNote ?? "",
        };
      });
    }
  } catch {/* ignore */}
  return [];
}

/**
 * Merge any per-guardrail observed data already persisted in inputData back
 * into the GuardrailRow list, so the wizard re-prefills on "Edit setup".
 */
function hydrateGuardrailsWithData(
  guardrails: GuardrailRow[],
  inputDataRaw: string | null | undefined,
): GuardrailRow[] {
  if (!inputDataRaw) return guardrails;
  try {
    const parsed = JSON.parse(inputDataRaw);
    const metrics = parsed?.metrics;
    if (!metrics || typeof metrics !== "object") return guardrails;
    return guardrails.map((g) => {
      if (!g.event || g.dataRows.length > 0) return g;
      const mData = metrics[g.event];
      if (!mData || typeof mData !== "object") return g;
      const rows: DataRow[] = Object.entries(
        mData as Record<string, { n?: number; k?: number; sum?: number; sum_squares?: number } | unknown>,
      )
        .filter(([k]) => k !== "inverse")
        .map(([variant, raw]) => {
          const v = raw as { n?: number; k?: number; sum?: number; sum_squares?: number };
          return {
            variant,
            n: String(v?.n ?? ""),
            s: String(v?.k ?? v?.sum ?? ""),
            ss: v?.sum_squares != null ? String(v.sum_squares) : "",
          };
        });
      return { ...g, dataRows: rows };
    });
  } catch { return guardrails; }
}

function parseInputDataToRows(
  raw: string | null | undefined,
  eventName: string,
): DataRow[] {
  if (!raw || !eventName) return [];
  try {
    const parsed = JSON.parse(raw);
    const metric = parsed?.metrics?.[eventName];
    if (!metric || typeof metric !== "object") return [];
    return Object.entries(
      metric as Record<string, { n?: number; k?: number; sum?: number; sum_squares?: number } | unknown>,
    )
      .filter(([k]) => k !== "inverse")
      .map(([variant, raw]) => {
        const v = raw as { n?: number; k?: number; sum?: number; sum_squares?: number };
        return {
          variant,
          n: String(v?.n ?? ""),
          s: String(v?.k ?? v?.sum ?? ""),
          ss: v?.sum_squares != null ? String(v.sum_squares) : "",
        };
      });
  } catch { return []; }
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Build a natural-language summary of the saved wizard state so the chat
 * agent can acknowledge what the user entered and offer an analysis.
 * Read directly from FormData (already validated) to avoid threading every
 * field through React state.
 */
function buildChatSummary(formData: FormData): string {
  const get = (k: string) => ((formData.get(k) as string | null) ?? "").trim();
  const method = get("method") === "bandit" ? "Multi-armed bandit" : "Bayesian A/B";
  const metricName = get("metricName");
  const metricEvent = get("metricEvent");
  const metricType = get("metricType") || "binary";
  const metricAgg = get("metricAgg") || "once";
  const primaryInverse = formData.get("primaryInverse") != null;
  const priorMode = get("priorMode") || "flat";
  const priorMean = get("priorMean");
  const priorStddev = get("priorStddev");
  const minSample = get("minimumSample");
  const obsStart = get("observationStart");
  const obsEnd = get("observationEnd");
  const control = get("controlVariant");
  const treatment = get("treatmentVariant");

  type GuardrailIn = {
    name?: string; event?: string; inverse?: boolean; metricType?: string;
    dataRows?: unknown[]; dataSource?: string; dataSourceNote?: string;
  };
  let guardrails: GuardrailIn[] = [];
  try {
    const parsed = JSON.parse(get("guardrails") || "[]");
    if (Array.isArray(parsed)) guardrails = parsed;
  } catch {/* ignore */}

  const primaryDataSource = get("primaryDataSource") || "manual";
  const primaryDataSourceNote = get("primaryDataSourceNote");

  type DataRowIn = { variant?: string; n?: string; s?: string };
  let primaryRowCount = 0;
  if (primaryDataSource === "manual") {
    try {
      const rows = JSON.parse(get("dataRows") || "[]") as DataRowIn[];
      primaryRowCount = rows.filter(
        (r) => r.variant?.trim() && r.n && Number(r.n) > 0,
      ).length;
    } catch {/* ignore */}
  }

  const guardrailsWithData = guardrails.filter(
    (g) => (g.dataSource ?? "manual") === "manual" && Array.isArray(g.dataRows) && g.dataRows.some((r: unknown) => {
      const row = r as DataRowIn;
      return row.variant?.trim() && row.n && Number(row.n) > 0;
    }),
  ).length;
  const nonManualGuardrails = guardrails.filter((g) => g.dataSource && g.dataSource !== "manual");

  const lines: string[] = [];
  lines.push("I just finished the expert setup wizard. Here's what I entered — please pull the experiment state and confirm you see the same thing:");
  lines.push("");
  lines.push(`- **Algorithm:** ${method}`);
  const aggLabel = metricAgg === "average"
    ? "averaged per user"
    : metricAgg === "sum"
      ? "summed per user"
      : metricAgg === "count"
        ? "counted per user"
        : "once per user";
  lines.push(
    `- **Primary metric:** ${metricName || "(no name)"} — \`${metricEvent}\`` +
    ` (${metricType}, ${aggLabel}${primaryInverse ? ", lower is better" : ""})`,
  );
  if (guardrails.length > 0) {
    lines.push(`- **Guardrails (${guardrails.length}):** ` +
      guardrails.map((g) =>
        `\`${g.event || g.name}\`${g.inverse ? " ↓" : ""}`,
      ).join(", "));
  }
  lines.push(`- **Variants:** control=\`${control}\`, treatment(s)=\`${treatment}\``);
  lines.push(
    `- **Prior:** ${priorMode === "proper"
      ? `informative (mean=${priorMean || "?"}, σ=${priorStddev || "?"})`
      : "flat (uninformative)"}`,
  );
  if (minSample) lines.push(`- **Minimum sample per variant:** ${minSample}`);
  if (obsStart || obsEnd) {
    lines.push(`- **Observation window:** ${obsStart || "—"} → ${obsEnd || "—"}`);
  }
  const primarySourceLabel = primaryDataSource === "featbit"
    ? "FeatBit + track-service (auto-pull)"
    : primaryDataSource === "external"
      ? `external${primaryDataSourceNote ? ` — ${primaryDataSourceNote}` : ""}`
      : "manual paste";
  lines.push(`- **Primary data source:** ${primarySourceLabel}`);
  if (primaryRowCount > 0) {
    lines.push(`- **Observed data:** pasted for ${primaryRowCount} primary variant row(s)` +
      (guardrailsWithData > 0 ? ` + ${guardrailsWithData} guardrail(s) manually pasted` : ""));
  } else if (primaryDataSource !== "manual") {
    lines.push("- **Observed data:** to come from the configured source above (no totals pasted)");
  } else {
    lines.push("- **Observed data:** not provided yet");
  }
  if (nonManualGuardrails.length > 0) {
    lines.push(`- **Guardrail data sources:** ${nonManualGuardrails.length} guardrail(s) configured to pull from non-manual sources`);
  }
  lines.push("");
  if (primaryRowCount > 0) {
    lines.push("Data is in — please run the Bayesian analysis on this run and walk me through what it means (signal, guardrail risk, what to do next).");
  } else if (primaryDataSource === "featbit") {
    lines.push("Data will come from track-service automatically. Can you trigger the pull and run the analysis? If not enough data yet, tell me when to retry.");
  } else if (primaryDataSource === "external") {
    lines.push("Data will come from an external source. What's the right next step — wait for me to import it, or set up the import pipeline now?");
  } else {
    lines.push("I haven't pasted data yet. What's the right next step — should I wait for data, or do you need more setup info first?");
  }
  return lines.join("\n");
}

/* ── Algorithm picker (radio cards) ── */
function AlgorithmPicker({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="grid grid-cols-2 gap-2">
      <input type="hidden" name="method" value={value} />
      {[
        { key: "bayesian_ab", label: "Bayesian A/B", desc: "Fixed traffic split, posterior inference." },
        { key: "bandit", label: "Multi-armed bandit", desc: "Adaptive allocation toward winning arm." },
      ].map((opt) => (
        <button
          type="button"
          key={opt.key}
          onClick={() => setValue(opt.key)}
          className={cn(
            "rounded-md border px-3 py-2 text-left transition-colors",
            value === opt.key
              ? "border-foreground bg-foreground/5"
              : "hover:bg-muted/40",
          )}
        >
          <div className="text-xs font-semibold">{opt.label}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
            {opt.desc}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Prior picker ── */
function PriorPicker({
  defaultMode, defaultMean, defaultStddev,
}: { defaultMode: "flat" | "proper"; defaultMean: string; defaultStddev: string }) {
  const [mode, setMode] = useState<"flat" | "proper">(defaultMode);
  return (
    <div className="space-y-2">
      <input type="hidden" name="priorMode" value={mode} />
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "flat" as const, label: "Flat prior", desc: "No prior belief — fully data-driven." },
          { key: "proper" as const, label: "Informative prior", desc: "Use past data as a Gaussian prior." },
        ].map((opt) => (
          <button
            type="button"
            key={opt.key}
            onClick={() => setMode(opt.key)}
            className={cn(
              "rounded-md border px-3 py-2 text-left transition-colors",
              mode === opt.key ? "border-foreground bg-foreground/5" : "hover:bg-muted/40",
            )}
          >
            <div className="text-xs font-semibold">{opt.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
      {mode === "proper" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="priorMean"
              label="Prior mean"
              className="text-xs"
              help="Expected relative effect before seeing data. 0 = you expect no difference; 0.1 = you expect a +10% lift. Shrinks early noisy estimates toward this value."
            />
            <Input
              id="priorMean"
              name="priorMean"
              type="number"
              step="0.0001"
              defaultValue={defaultMean}
              placeholder="e.g. 0.1"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Expected baseline rate / mean from prior data.
            </p>
          </div>
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="priorStddev"
              label="Prior stddev"
              className="text-xs"
              help="Uncertainty around the prior mean. Larger = weaker prior (data dominates faster). Typical values: 0.1–0.5. If unsure, 0.3 is a safe default."
            />
            <Input
              id="priorStddev"
              name="priorStddev"
              type="number"
              step="0.0001"
              defaultValue={defaultStddev}
              placeholder="e.g. 0.3"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Uncertainty around the prior mean.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Data source picker — manual paste / FeatBit auto-pull / external ── */
function DataSourcePicker({
  value,
  note,
  onChange,
  onNoteChange,
  size = "md",
}: {
  value: DataSource;
  note: string;
  onChange: (v: DataSource) => void;
  onNoteChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  const opts: { key: DataSource; label: string; desc: string }[] = [
    { key: "manual",   label: "Paste manually",     desc: "Enter per-variant totals below." },
    { key: "featbit",  label: "FeatBit + tracking", desc: "Auto-pull from track-service using flag + event." },
    { key: "external", label: "External / other",   desc: "Coming from an outside API or warehouse." },
  ];
  const padding = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2";
  const titleSize = size === "sm" ? "text-[11px]" : "text-xs";
  const descSize = size === "sm" ? "text-[10px]" : "text-[10px]";
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-2">
        {opts.map((opt) => (
          <button
            type="button"
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              "rounded-md border text-left transition-colors",
              padding,
              value === opt.key ? "border-foreground bg-foreground/5" : "hover:bg-muted/40",
            )}
          >
            <div className={cn("font-semibold", titleSize)}>{opt.label}</div>
            <div className={cn("text-muted-foreground mt-0.5 leading-tight", descSize)}>
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
      {value === "external" && (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          placeholder="Where will the data come from? (e.g. Snowflake query, internal API, manual export)"
          className="text-xs resize-none"
        />
      )}
      {value === "featbit" && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          The analyzer will query <code>track.featbit.ai</code> using this experiment&apos;s
          flag key, the event name above, and the observation window.
        </p>
      )}
    </div>
  );
}

/* ── Guardrails editor (reuses metric-edit pattern, adds event name) ── */
function GuardrailsEditor({
  initial,
  defaultVariants,
}: {
  initial: GuardrailRow[];
  defaultVariants: string[];
}) {
  const [rows, setRows] = useState<GuardrailRow[]>(initial);

  function update<K extends keyof GuardrailRow>(i: number, field: K, v: GuardrailRow[K]) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  }
  function add() {
    setRows((prev) => [
      ...prev,
      {
        name: "", event: "", description: "", inverse: false,
        metricType: "binary",
        metricAgg: "once",
        dataRows: defaultVariants.map((v) => ({ variant: v, n: "", s: "", ss: "" })),
        dataSource: "manual",
        dataSourceNote: "",
      },
    ]);
  }
  function remove(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      <input type="hidden" name="guardrails" value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="rounded-md border px-2.5 py-2 space-y-2 relative">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute top-2 right-2 text-muted-foreground/40 hover:text-destructive"
            title="Remove"
          >
            <X className="size-3" />
          </button>
          <div className="grid grid-cols-2 gap-2 pr-5">
            <div className="space-y-1">
              <LabelWithHelp
                label="Name"
                className="text-[10px] uppercase text-muted-foreground"
                help="Human-readable label for this guardrail."
              />
              <Input
                value={row.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="Checkout abandonment"
                className="text-xs h-7"
              />
            </div>
            <div className="space-y-1">
              <LabelWithHelp
                label="Event"
                className="text-[10px] uppercase text-muted-foreground"
                help="SDK event key sent to FeatBit for this guardrail metric. Must match the tracked event name exactly."
              />
              <Input
                value={row.event}
                onChange={(e) => update(i, "event", e.target.value)}
                placeholder="checkout_abandoned"
                className="text-xs font-mono h-7"
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 pr-5 items-end">
            <div className="space-y-1">
              <LabelWithHelp
                label="Description"
                className="text-[10px] uppercase text-muted-foreground"
                help="Short note on what this guardrail protects against. Included in the decision record."
              />
              <Textarea
                value={row.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="Must not regress"
                rows={1}
                className="text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <LabelWithHelp
                label="Type"
                className="text-[10px] uppercase text-muted-foreground"
                help={(
                  <>
                    <b>Binary</b> — pass <code>n</code> + <code>k</code> (converters).
                    <br />
                    <b>Numeric</b> — pass <code>n</code> + <code>sum</code> + <code>sum_squares</code>.
                  </>
                )}
              />
              <select
                value={row.metricType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  update(i, "metricType", nextType);
                  update(i, "metricAgg", coerceAggForType(row.metricAgg, nextType));
                }}
                className={cn(
                  "h-7 rounded-lg border border-input bg-transparent px-2 py-0 text-xs",
                  "transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <option value="binary">Binary</option>
                <option value="continuous">Numeric</option>
              </select>
            </div>
            <div className="space-y-1">
              <LabelWithHelp
                label="Agg"
                className="text-[10px] uppercase text-muted-foreground"
                help={row.metricType === "binary" ? (
                  <>Binary metrics aggregate as <b>once per user</b> — there is no other meaningful choice.</>
                ) : (
                  <>
                    <b>Count</b> — number of events per user.
                    <br />
                    <b>Sum</b> — sum of values per user.
                    <br />
                    <b>Average</b> — mean of values per user.
                  </>
                )}
              />
              <select
                value={row.metricAgg}
                onChange={(e) => update(i, "metricAgg", e.target.value)}
                disabled={row.metricType === "binary"}
                className={cn(
                  "h-7 rounded-lg border border-input bg-transparent px-2 py-0 text-xs",
                  "transition-colors outline-none disabled:opacity-60",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                {row.metricType === "binary" ? (
                  <option value="once">Once per user</option>
                ) : (
                  <>
                    <option value="count">Count</option>
                    <option value="sum">Sum</option>
                    <option value="average">Average</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <label
            className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] cursor-pointer select-none transition-colors",
              row.inverse
                ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-border bg-muted/20 hover:bg-muted/40",
            )}
          >
            <input
              type="checkbox"
              checked={row.inverse}
              onChange={(e) => update(i, "inverse", e.target.checked)}
              className="size-4 mt-0.5 accent-amber-600"
            />
            <span className="flex-1">
              <span className="font-medium text-foreground">Lower is better</span>
              <span className="text-muted-foreground"> — a DECREASE is the win for this guardrail. Check this for metrics like abandonment, error rate, latency.</span>
            </span>
            <FieldHelp>
              <b>Critical:</b> the analyzer computes <code>P(harm)</code> based on this flag.
              <br />• Unchecked (default) → higher is better, P(harm) = P(treatment &lt; control).
              <br />• Checked → lower is better, P(harm) = P(treatment &gt; control).
              <br />Setting this wrong flips P(harm) and the verdict — a huge regression can read as &quot;healthy&quot; if inverse isn&apos;t set.
            </FieldHelp>
          </label>

          {/* Data source for this guardrail */}
          <div className="space-y-1.5 rounded-md bg-muted/20 px-2 py-2">
            <div className="text-[10px] uppercase text-muted-foreground font-medium">
              Data source
            </div>
            <DataSourcePicker
              size="sm"
              value={row.dataSource}
              note={row.dataSourceNote}
              onChange={(v) => update(i, "dataSource", v)}
              onNoteChange={(v) => update(i, "dataSourceNote", v)}
            />
            {row.dataSource === "manual" && (
              <GuardrailDataTable
                metricType={row.metricType}
                rows={row.dataRows.length > 0
                  ? row.dataRows
                  : defaultVariants.map((v) => ({ variant: v, n: "", s: "", ss: "" }))}
                onChange={(next) => update(i, "dataRows", next)}
              />
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
        Add guardrail
      </button>
    </div>
  );
}

/* ── Nested data table inside each guardrail row ── */
function GuardrailDataTable({
  rows,
  metricType,
  onChange,
}: {
  rows: DataRow[];
  metricType: string;
  onChange: (next: DataRow[]) => void;
}) {
  const isNumeric = metricType === "continuous";
  const gridCols = isNumeric
    ? "grid-cols-[1fr_1fr_1fr_1fr_auto]"
    : "grid-cols-[1fr_1fr_1fr_auto]";

  function update(i: number, field: keyof DataRow, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  }
  function add() { onChange([...rows, { variant: "", n: "", s: "", ss: "" }]); }
  function remove(i: number) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-1.5 rounded-md bg-muted/20 px-2 py-2">
      <div className="text-[10px] uppercase text-muted-foreground font-medium">
        Observed data <span className="text-muted-foreground/50">(optional)</span>
      </div>
      <div className={`grid ${gridCols} gap-2 text-[10px] uppercase text-muted-foreground/70 px-1`}>
        <span>Variant<RequiredStar /></span>
        <span>Users (n)<RequiredStar /></span>
        <span>{isNumeric ? <>Σ x<RequiredStar /></> : <>k<RequiredStar /></>}</span>
        {isNumeric && <span>Σ x²<RequiredStar /></span>}
        <span />
      </div>
      {rows.map((row, i) => {
        const rowHasData =
          row.variant.trim().length > 0 ||
          row.n.length > 0 ||
          row.s.length > 0 ||
          row.ss.length > 0;
        return (
        <div key={i} className={`grid ${gridCols} gap-2 items-center`}>
          <Input
            value={row.variant}
            onChange={(e) => update(i, "variant", e.target.value)}
            placeholder="control"
            className="text-xs font-mono h-6"
            required={rowHasData}
          />
          <Input
            type="number" step="1" min="1"
            value={row.n}
            onChange={(e) => update(i, "n", e.target.value)}
            placeholder="1000"
            className="text-xs h-6"
            required={rowHasData}
          />
          <Input
            type="number" step="0.01" min="0"
            value={row.s}
            onChange={(e) => update(i, "s", e.target.value)}
            placeholder={isNumeric ? "4250.5" : "150"}
            className="text-xs h-6"
            required={rowHasData}
          />
          {isNumeric && (
            <Input
              type="number" step="0.01" min="0"
              value={row.ss}
              onChange={(e) => update(i, "ss", e.target.value)}
              placeholder="27500"
              className="text-xs h-6"
              required={rowHasData}
            />
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-muted-foreground/40 hover:text-destructive"
            title="Remove"
          >
            <X className="size-3" />
          </button>
        </div>
      );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
        Add variant row
      </button>
    </div>
  );
}

/* ── Variant data table ── */
function VariantsDataEditor({
  initial, metricType, metricAgg,
}: { initial: DataRow[]; metricType: string; metricAgg: string }) {
  const base: DataRow[] = initial.length > 0
    ? initial
    : [
        { variant: "control", n: "", s: "", ss: "" },
        { variant: "treatment", n: "", s: "", ss: "" },
      ];
  const [rows, setRows] = useState<DataRow[]>(base);
  const isNumeric = metricType === "continuous";

  function update(i: number, field: keyof DataRow, v: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  }
  function add() { setRows((prev) => [...prev, { variant: "", n: "", s: "", ss: "" }]); }
  function remove(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  const gridCols = isNumeric
    ? "grid-cols-[1fr_1fr_1fr_1fr_auto]"
    : "grid-cols-[1fr_1fr_1fr_auto]";

  const perUser = describePerUserValue(metricAgg);

  return (
    <div className="space-y-2">
      <input type="hidden" name="dataRows" value={JSON.stringify(rows)} />
      <div className={`grid ${gridCols} gap-2 text-[10px] uppercase text-muted-foreground px-1`}>
        <span>Variant<RequiredStar /></span>
        <span>Users (n)<RequiredStar /></span>
        <span>
          {isNumeric ? <>Σ x<RequiredStar /></> : <>Conversions (k)<RequiredStar /></>}
        </span>
        {isNumeric && <span>Σ x²<RequiredStar /></span>}
        <span />
      </div>
      {rows.map((row, i) => {
        const rowHasData =
          row.variant.trim().length > 0 ||
          row.n.length > 0 ||
          row.s.length > 0 ||
          row.ss.length > 0;
        return (
        <div key={i} className={`grid ${gridCols} gap-2 items-center`}>
          <Input
            value={row.variant}
            onChange={(e) => update(i, "variant", e.target.value)}
            placeholder="control"
            className="text-xs font-mono h-7"
            required={rowHasData}
          />
          <Input
            type="number"
            step="1"
            min="1"
            value={row.n}
            onChange={(e) => update(i, "n", e.target.value)}
            placeholder="1000"
            className="text-xs h-7"
            required={rowHasData}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            value={row.s}
            onChange={(e) => update(i, "s", e.target.value)}
            placeholder={isNumeric ? "4250.5" : "150"}
            className="text-xs h-7"
            required={rowHasData}
          />
          {isNumeric && (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={row.ss}
              onChange={(e) => update(i, "ss", e.target.value)}
              placeholder="27500"
              className="text-xs h-7"
              required={rowHasData}
            />
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-muted-foreground/40 hover:text-destructive"
            title="Remove"
          >
            <X className="size-3" />
          </button>
        </div>
      );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
        Add variant
      </button>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {isNumeric ? (
          <>
            For <b>numeric</b> metrics, first compute each user&apos;s
            value <code>x</code> = <i>{perUser}</i>. Then for each variant fill:
            <br />• <b>n</b> = distinct users
            <br />• <b>Σ x</b> = sum of per-user values
            <br />• <b>Σ x²</b> = sum of per-user values squared (needed for variance — can&apos;t be derived from n + Σ x)
          </>
        ) : (
          <>
            For <b>binary</b> metrics, provide the number of users (<i>n</i>)
            and the number of converters (<i>k</i>).
          </>
        )}{" "}
        Leave the whole row empty to skip and fill later — but partial rows
        will be rejected.
      </p>
    </div>
  );
}

function describePerUserValue(metricAgg: string): string {
  switch (metricAgg) {
    case "count":   return "the count of events that user fired";
    case "average": return "the mean of that user's event values";
    case "sum":
    default:        return "the sum of that user's event values";
  }
}

function RequiredStar() {
  return <span className="text-destructive ml-0.5">*</span>;
}

/* ── Wizard steps ── */
const STEPS = [
  { key: "algorithm",   label: "Algorithm + variants", icon: Beaker },
  { key: "datasource",  label: "Data source",          icon: Cable },
  { key: "observation", label: "Observation window",   icon: Calendar },
  { key: "metric",      label: "Primary metric",       icon: Target },
  { key: "prior",       label: "Prior & stopping",     icon: Sigma },
  { key: "guardrails",  label: "Guardrails",           icon: ShieldCheck },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function StepNav({
  currentStep,
  onSelect,
}: {
  currentStep: StepKey;
  onSelect: (k: StepKey) => void;
}) {
  return (
    <nav className="w-52 shrink-0 space-y-0.5 border-r pr-3">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const active = currentStep === s.key;
        return (
          <button
            type="button"
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors",
              active
                ? "bg-foreground/10 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <Icon className="size-3.5 shrink-0" />
            <span className="flex-1 leading-tight">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Section wrapper ── */
function Section({
  icon, title, subtitle, help, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border px-3 pb-3 pt-2">
      <legend className="px-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
        {help && <FieldHelp>{help}</FieldHelp>}
      </legend>
      {subtitle && <p className="text-[10px] text-muted-foreground -mt-1">{subtitle}</p>}
      {children}
    </fieldset>
  );
}

/* ── Main dialog ── */
export function ExpertSetupDialog({
  experiment,
  open,
  onOpenChange,
  onSaved,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fires after a successful save — receives a ready-to-send chat summary. */
  onSaved?: (chatSummary: string) => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Expert experiment setup</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Walk through each step, or jump around using the sidebar. Anything
            you enter is preserved when you switch — and editable later.
          </p>
        </DialogHeader>
        {open && (
          <ExpertSetupForm
            experiment={experiment}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
            onExperimentUpdated={onExperimentUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExpertSetupForm({
  experiment,
  onDone,
  onSaved,
  onExperimentUpdated,
}: {
  experiment: Experiment & { experimentRuns: ExperimentRun[] };
  onDone: () => void;
  onSaved?: (chatSummary: string) => void;
  onExperimentUpdated?: () => Promise<unknown>;
}) {
  // Prefill from the first existing run if any, else from experiment fields.
  const existingRun = experiment.experimentRuns[0];
  const metric = parsePrimaryMetric(experiment.primaryMetric);
  const guardrailRows = hydrateGuardrailsWithData(
    parseGuardrails(experiment.guardrails),
    existingRun?.inputData,
  );

  const method = existingRun?.method ?? "bayesian_ab";
  const priorMode = existingRun?.priorProper ? "proper" : "flat";
  const priorMean = existingRun?.priorMean != null ? String(existingRun.priorMean) : "";
  const priorStddev = existingRun?.priorStddev != null ? String(existingRun.priorStddev) : "";
  const minimumSample = existingRun?.minimumSample != null ? String(existingRun.minimumSample) : "";
  const controlVariant = existingRun?.controlVariant ?? "control";
  const treatmentVariant = existingRun?.treatmentVariant ?? "treatment";
  const dataRows = parseInputDataToRows(existingRun?.inputData, existingRun?.primaryMetricEvent ?? metric.event);

  // Controlled state so nested sub-editors (variant hints for guardrails) react.
  const [metricType, setMetricType] = useState<string>(metric.metricType);
  const [metricAgg, setMetricAgg] = useState<string>(
    coerceAggForType(metric.metricAgg, metric.metricType),
  );
  const [primaryInverse, setPrimaryInverse] = useState<boolean>(metric.inverse);
  const [controlName, setControlName] = useState<string>(controlVariant);
  const [treatmentNames, setTreatmentNames] = useState<string>(treatmentVariant);
  const [primaryDataSource, setPrimaryDataSource] = useState<DataSource>(metric.dataSource);
  const [primaryDataSourceNote, setPrimaryDataSourceNote] = useState<string>(metric.dataSourceNote);
  const defaultVariants = [
    controlName.trim() || "control",
    ...treatmentNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  const [currentStep, setCurrentStep] = useState<StepKey>("algorithm");
  const [saving, setSaving] = useState(false);
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === STEPS.length - 1;

  // Project-level data source — owned by the new "Data source" step. Pre-fill
  // from the existing run so re-opening the wizard preserves the choice.
  const initialMode: DataSourceMode =
    existingRun?.dataSourceMode === "manual"           ? "manual"           :
    existingRun?.dataSourceMode === "external-text"    ? "external-text"    :
    "featbit-managed";
  const { currentProject } = useAuth();
  const projectKey = currentProject?.key ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await saveExpertSetupAction(formData);
      await onExperimentUpdated?.();
      onSaved?.(buildChatSummary(formData));
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <TooltipProvider delay={150}>
    <form
      onSubmit={handleSubmit}
      className="pt-1"
    >
      <input type="hidden" name="experimentId" value={experiment.id} />
      {existingRun && (
        <input type="hidden" name="experimentRunId" value={existingRun.id} />
      )}

      <div className="flex gap-4">
      <StepNav currentStep={currentStep} onSelect={setCurrentStep} />
      <div className="flex-1 min-w-0 space-y-4">

      {/* ── Algorithm + variants ── */}
      <div hidden={currentStep !== "algorithm"} className="space-y-4">
      <Section
        icon={<Beaker className="size-3.5" />}
        title="Algorithm"
        help={(
          <>
            <b>Bayesian A/B</b> — fixed traffic split, posterior probability of win and harm per variant. Best when you need a clean comparison.
            <br />
            <b>Multi-armed bandit</b> — adaptively shifts traffic toward the winning arm as data comes in. Best when minimizing regret matters more than a clean A/B comparison.
          </>
        )}
      >
        <AlgorithmPicker defaultValue={method} />
      </Section>
      <Section
        icon={<Database className="size-3.5" />}
        title="Variants"
        subtitle="Names must match the variant keys in your FeatBit flag, and the data rows you'll fill in later."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="controlVariant"
              label="Control variant"
              className="text-xs"
              help="Variant name treated as the baseline. Must match the variant key in your FeatBit flag and in the data rows."
            />
            <Input
              id="controlVariant"
              name="controlVariant"
              value={controlName}
              onChange={(e) => setControlName(e.target.value)}
              placeholder="control"
              className="text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="treatmentVariant"
              label="Treatment variant(s)"
              className="text-xs"
              help="Variant(s) being compared against control. Use a comma-separated list for multiple arms (bandit)."
            />
            <Input
              id="treatmentVariant"
              name="treatmentVariant"
              value={treatmentNames}
              onChange={(e) => setTreatmentNames(e.target.value)}
              placeholder="treatment"
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Comma-separated for multiple arms (bandit).
            </p>
          </div>
        </div>
      </Section>
      </div>

      {/* ── Data source ── */}
      <div hidden={currentStep !== "datasource"} className="space-y-4">
      <Section
        icon={<Cable className="size-3.5" />}
        title="Where does the metric data come from?"
        subtitle="Picks the path the analyser will use to fetch per-variant statistics for this run."
      >
        <DataSourceStepContent
          projectKey={projectKey}
          initialMode={initialMode}
          initialCustomerConfig={null}
          initialExternalNote=""
        />
      </Section>
      </div>

      {/* ── Primary metric (North Star) ── */}
      <div hidden={currentStep !== "metric"}>
      <Section
        icon={<Target className="size-3.5" />}
        title="Primary Metric (North Star)"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="metricName"
              label="Name"
              className="text-xs"
              help="Human-readable label for this metric, shown in the UI and decision notes (e.g. 'Checkout completion rate'). Does not need to match any event key."
            />
            <Input
              id="metricName"
              name="metricName"
              defaultValue={metric.name}
              placeholder="Checkout completion rate"
              className="text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="metricEvent"
              label="Event"
              className="text-xs"
              help="The event key your SDK sends to FeatBit (e.g. 'purchase_completed'). Must match the code exactly — the analyzer uses it to look up per-variant counts."
            />
            <Input
              id="metricEvent"
              name="metricEvent"
              defaultValue={metric.event}
              placeholder="purchase_completed"
              className="text-sm font-mono"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="metricType"
              label="Type"
              className="text-xs"
              help={(
                <>
                  <b>Binary</b>: yes/no outcome per user — the analyzer needs
                  <code> n</code> (users) and <code>k</code> (converters).
                  <br />
                  <b>Numeric</b>: a value per user (revenue, duration) — the
                  analyzer needs <code>n</code>, <code>sum</code>, and
                  <code> sum_squares</code> to compute variance.
                </>
              )}
            />
            <select
              id="metricType"
              name="metricType"
              value={metricType}
              onChange={(e) => {
                const next = e.target.value;
                setMetricType(next);
                setMetricAgg(coerceAggForType(metricAgg, next));
              }}
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                "transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <option value="binary">Binary (conversion)</option>
              <option value="continuous">Numeric (value)</option>
            </select>
          </div>
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="metricAgg"
              label="Aggregation"
              className="text-xs"
              help={metricType === "binary" ? (
                <>
                  Binary metrics are yes/no per user, so the only meaningful
                  aggregation is <b>Once per user</b> — count each user at
                  most once toward the conversion total.
                </>
              ) : (
                <>
                  Per-user value when a user fires the event multiple times:
                  <br />• <b>Count all</b> — number of events the user fired (clicks per user).
                  <br />• <b>Sum values</b> — total of the user&apos;s event values (revenue per user, LTV-style).
                  <br />• <b>Average values</b> — mean of the user&apos;s event values (avg ticket size per user, AOV-style).
                  <br />The analyzer always compares per-user means across variants — pick what each user&apos;s contribution should mean.
                </>
              )}
            />
            <select
              id="metricAgg"
              name="metricAgg"
              value={metricAgg}
              onChange={(e) => setMetricAgg(e.target.value)}
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                "transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              {metricType === "binary" ? (
                <option value="once">Once per user</option>
              ) : (
                <>
                  <option value="count">Count all events</option>
                  <option value="sum">Sum event values</option>
                  <option value="average">Average values per user</option>
                </>
              )}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <LabelWithHelp
            htmlFor="metricDescription"
            label="Description (optional)"
            className="text-xs"
            help="Free-text context about what the metric measures and why it matters — goes into the decision record and helps the AI reason about tradeoffs."
          />
          <Textarea
            id="metricDescription"
            name="metricDescription"
            defaultValue={metric.description}
            rows={2}
            className="text-xs resize-none"
            placeholder="What does this measure and why does it matter?"
          />
        </div>
        <label
          className={cn(
            "flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] cursor-pointer select-none transition-colors",
            primaryInverse
              ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
              : "border-border bg-muted/20 hover:bg-muted/40",
          )}
        >
          <input
            type="checkbox"
            name="primaryInverse"
            checked={primaryInverse}
            onChange={(e) => setPrimaryInverse(e.target.checked)}
            className="size-4 mt-0.5 accent-amber-600"
          />
          <span className="flex-1">
            <span className="font-medium text-foreground">Lower is better (inverse)</span>
            <span className="text-muted-foreground"> — check for metrics where a DECREASE is the win: latency, error rate, bounce rate, drop-off.</span>
          </span>
          <FieldHelp>
            <b>Critical — sets the direction of P(harm) / P(win).</b>
            <br />• Unchecked (default) → higher is better.
            <br />• Checked → lower is better.
            <br />If this is wrong, a huge regression can show up as verdict <i>&quot;strong signal → adopt treatment&quot;</i> because the analyzer thinks your metric is going the right way.
          </FieldHelp>
        </label>

        {/* Data source + observed data for the primary metric */}
        <div className="space-y-2 rounded-md bg-muted/20 px-2.5 py-2.5">
          <div className="text-[10px] uppercase text-muted-foreground font-medium">
            Data source
          </div>
          <input type="hidden" name="primaryDataSource" value={primaryDataSource} />
          <input type="hidden" name="primaryDataSourceNote" value={primaryDataSourceNote} />
          <DataSourcePicker
            value={primaryDataSource}
            note={primaryDataSourceNote}
            onChange={setPrimaryDataSource}
            onNoteChange={setPrimaryDataSourceNote}
          />
          {primaryDataSource === "manual" && (
            <VariantsDataEditor initial={dataRows} metricType={metricType} metricAgg={metricAgg} />
          )}
        </div>
      </Section>
      </div>

      {/* ── Guardrails ── */}
      <div hidden={currentStep !== "guardrails"}>
      <Section
        icon={<ShieldCheck className="size-3.5" />}
        title="Guardrails"
        subtitle="Metrics that must not regress. Add observed data per guardrail to include it in analysis."
      >
        <GuardrailsEditor initial={guardrailRows} defaultVariants={defaultVariants} />
      </Section>
      </div>

      {/* ── Priors & min sample ── */}
      <div hidden={currentStep !== "prior"}>
      <Section
        icon={<Sigma className="size-3.5" />}
        title="Prior & Stopping"
        help={(
          <>
            Controls how the analyzer combines past belief with observed data, plus the floor for when a decision is allowed.
            <br />
            <b>Flat prior</b>: no prior belief — the data drives everything.
            <br />
            <b>Informative prior</b>: a Gaussian prior (mean, stddev) shrinks early noisy results toward your prior belief. Use when you have past A/B data or a known baseline.
          </>
        )}
      >
        <PriorPicker
          defaultMode={priorMode}
          defaultMean={priorMean}
          defaultStddev={priorStddev}
        />
        <div className="space-y-1">
          <LabelWithHelp
            htmlFor="minimumSample"
            label="Minimum sample per variant"
            className="text-xs"
            help="The analysis stays INCONCLUSIVE until each variant has at least this many users / events. Protects against declaring a winner on noisy early data. Leave blank for no floor."
          />
          <Input
            id="minimumSample"
            name="minimumSample"
            type="number"
            step="1"
            min="0"
            defaultValue={minimumSample}
            placeholder="e.g. 500"
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Analysis stays INCONCLUSIVE until each variant reaches this sample
            size. Leave blank for no minimum.
          </p>
        </div>
      </Section>
      </div>

      {/* ── Observation window ── */}
      <div hidden={currentStep !== "observation"}>
      <Section
        icon={<Calendar className="size-3.5" />}
        title="Observation Window"
        subtitle="When did / will this experiment collect data? Leave blank to let the analyzer default to the last 30 days."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="observationStart"
              label="Start"
              className="text-xs"
              help="First day data was collected for this run. Shown in the decision report; also used by the analyzer when pulling live data from track-service."
            />
            <Input
              id="observationStart"
              name="observationStart"
              type="date"
              defaultValue={toDateInput(existingRun?.observationStart)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <LabelWithHelp
              htmlFor="observationEnd"
              label="End"
              className="text-xs"
              help="Last day of the observation window. Leave blank while the run is ongoing — the analyzer will use today."
            />
            <Input
              id="observationEnd"
              name="observationEnd"
              type="date"
              defaultValue={toDateInput(existingRun?.observationEnd)}
              className="text-sm"
            />
          </div>
        </div>
      </Section>
      </div>

      </div>
      </div>

      <DialogFooter className="gap-2 pt-3 border-t mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFirst}
          onClick={() => setCurrentStep(STEPS[currentIdx - 1].key)}
        >
          Back
        </Button>
        {!isLast && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(STEPS[currentIdx + 1].key)}
          >
            Next
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Save setup"}
        </Button>
      </DialogFooter>
    </form>
    </TooltipProvider>
  );
}
