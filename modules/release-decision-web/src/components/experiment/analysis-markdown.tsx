/* ── Typed analysis renderer ──────────────────────────────────
   Renders structured JSON stored in Experiment.analysisResult.
   Supports both Bayesian A/B and Bandit experiment types.
   ─────────────────────────────────────────────────────────── */

"use client";

import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── JSON type definitions ── */

interface SrmCheck {
  chi2_p_value: number;
  ok: boolean;
  observed: Record<string, number>;
}

interface MetricRow {
  variant: string;
  n: number;
  is_control: boolean;
  conversions?: number;
  rate?: number;
  mean?: number;
  rel_delta?: number;
  ci_lower?: number;
  ci_upper?: number;
  p_win?: number;
  p_harm?: number;
  p_increase?: number;
  p_decrease_gt5pct?: number;
  risk_ctrl?: number;
  risk_trt?: number;
}

interface MetricSection {
  event: string;
  metric_type: string;
  metric_agg?: "once" | "count" | "sum" | "average";
  inverse?: boolean;
  unit?: string;
  rows: MetricRow[];
  verdict: string;
}

interface BayesianAnalysis {
  type: "bayesian";
  experiment: string;
  computed_at: string;
  window: { start: string; end: string };
  control: string;
  treatments: string[];
  prior: string;
  srm: SrmCheck;
  primary_metric: MetricSection | null;
  guardrails: MetricSection[];
  sample_check: {
    minimum_per_variant: number;
    ok: boolean;
    variants: Record<string, number>;
  };
  warnings?: string[];
}

interface BanditArm {
  arm: string;
  n: number;
  conversions: number;
  rate: number;
}

interface ThompsonResult {
  arm: string;
  p_best: number;
  recommended_weight: number;
}

interface BanditAnalysis {
  type: "bandit";
  experiment: string;
  computed_at: string;
  window: { start: string; end: string };
  metric: string;
  algorithm: string;
  srm: SrmCheck;
  arms: BanditArm[];
  thompson_sampling: {
    results: ThompsonResult[];
    enough_units: boolean;
    update_message: string;
  };
  stopping: {
    met: boolean;
    best_arm: string;
    p_best: number;
    threshold: number;
    message: string;
  };
}

type AnalysisData = BayesianAnalysis | BanditAnalysis;

/* ── Helpers ── */

function pct(v: number | undefined): string {
  if (v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function pctPlain(v: number | undefined): string {
  if (v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function pColor(p: number | undefined, goodAbove: number): string {
  if (p === undefined) return "";
  if (p >= goodAbove) return "text-green-700 dark:text-green-400 font-semibold";
  if (p >= goodAbove * 0.8) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400";
}

function harmColor(p: number | undefined, threshold = 0.5): string {
  if (p === undefined) return "";
  if (p < threshold * 0.5) return "text-green-700 dark:text-green-400";
  if (p < threshold) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400 font-semibold";
}

/* ── Posterior distribution chart (SVG) ── */

/** Standard gaussian PDF */
function gaussPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function PosteriorChart({ section }: { section: MetricSection | null }) {
  if (!section) return null;
  const treatment = section.rows.find((r) => !r.is_control);
  if (
    !treatment ||
    treatment.rel_delta === undefined ||
    treatment.ci_lower === undefined ||
    treatment.ci_upper === undefined
  )
    return null;

  const mu = treatment.rel_delta;
  const sigma = (treatment.ci_upper - treatment.ci_lower) / (2 * 1.96);
  if (sigma <= 0) return null;

  const W = 320;
  const H = 100;
  const PAD_X = 32;
  const PAD_TOP = 4;
  const PAD_BOT = 18;

  const data = useMemo(() => {
    const lo = mu - 3.5 * sigma;
    const hi = mu + 3.5 * sigma;
    const N = 80;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const xVal = lo + (hi - lo) * (i / N);
      pts.push({ x: xVal, y: gaussPdf(xVal, mu, sigma) });
    }
    return { lo, hi, pts, yMax: gaussPdf(mu, mu, sigma) };
  }, [mu, sigma]);

  const { lo, hi, pts, yMax } = data;

  const sx = (v: number) => PAD_X + ((v - lo) / (hi - lo)) * (W - 2 * PAD_X);
  const sy = (v: number) => PAD_TOP + (1 - v / yMax) * (H - PAD_TOP - PAD_BOT);

  // Build full curve path
  const curvePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ");

  // Build shaded CI region
  const ciLo = treatment.ci_lower;
  const ciHi = treatment.ci_upper;
  const ciPts = pts.filter((p) => p.x >= ciLo && p.x <= ciHi);
  const baseline = sy(0);
  const ciPath =
    ciPts.length > 1
      ? `M${sx(ciLo).toFixed(1)},${baseline} ` +
        ciPts.map((p) => `L${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ") +
        ` L${sx(ciHi).toFixed(1)},${baseline} Z`
      : "";

  const zeroX = sx(0);
  const muX = sx(mu);

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">
        Posterior Distribution of Relative Effect (δ)
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[400px] h-auto"
        role="img"
        aria-label={`Posterior distribution: δ = ${(mu * 100).toFixed(1)}%, 95% CI [${(ciLo * 100).toFixed(1)}%, ${(ciHi * 100).toFixed(1)}%]`}
      >
        {/* CI shaded area */}
        {ciPath && (
          <path d={ciPath} fill="currentColor" className="text-blue-200 dark:text-blue-800" opacity="0.5" />
        )}

        {/* Curve */}
        <path d={curvePath} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-600 dark:text-blue-400" />

        {/* Zero line */}
        {zeroX >= PAD_X && zeroX <= W - PAD_X && (
          <>
            <line x1={zeroX} y1={PAD_TOP} x2={zeroX} y2={baseline} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,2" className="text-muted-foreground" />
            <text x={zeroX} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>0%</text>
          </>
        )}

        {/* Mean line + label */}
        <line x1={muX} y1={PAD_TOP} x2={muX} y2={baseline} stroke="currentColor" strokeWidth="0.75" className="text-blue-600 dark:text-blue-400" />
        <text x={muX} y={H - 2} textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" style={{ fontSize: 9, fontWeight: 600 }}>
          {mu >= 0 ? "+" : ""}{(mu * 100).toFixed(1)}%
        </text>

        {/* CI bounds labels */}
        <text x={sx(ciLo)} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
          {(ciLo * 100).toFixed(1)}%
        </text>
        <text x={sx(ciHi)} y={H - 2} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
          {(ciHi * 100).toFixed(1)}%
        </text>

        {/* Baseline */}
        <line x1={PAD_X} y1={baseline} x2={W - PAD_X} y2={baseline} stroke="currentColor" strokeWidth="0.5" className="text-border" />
      </svg>
    </div>
  );
}

/* ── SRM badge ── */
function SrmBadge({ srm }: { srm: SrmCheck }) {
  const ok = srm.ok;
  const entries = Object.entries(srm.observed);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="font-medium text-muted-foreground">SRM</span>
      <span>
        p={srm.chi2_p_value.toFixed(4)}{" "}
        <span className={ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400 font-semibold"}>
          {ok ? "ok" : "IMBALANCE"}
        </span>
      </span>
      <span className="text-muted-foreground">
        ({entries.map(([v, n]) => `${v}=${n}`).join(", ")})
      </span>
    </div>
  );
}

/**
 * Describe the per-variant value column shown in the analysis table.
 * Bayesian numeric analysis always compares per-user means (sum/n), regardless
 * of how the user aggregated events into `sum`. This helper makes the column
 * label match the user's mental model and explains the math in a tooltip.
 */
function describeValueColumn(section: MetricSection): {
  label: string;
  help: React.ReactNode;
} {
  if (section.metric_type === "proportion") {
    return {
      label: "rate",
      help: (
        <>
          Per-variant conversion rate = <code>k / n</code>. The Bayesian test
          compares treatment&apos;s rate against control&apos;s.
        </>
      ),
    };
  }
  // Continuous (numeric)
  switch (section.metric_agg) {
    case "count":
      return {
        label: "events / user",
        help: (
          <>
            Mean events per user = <code>Σ x / n</code>, where each user&apos;s
            <code> x</code> = number of events they fired. You picked
            &ldquo;Count all&rdquo; aggregation. The Bayesian test compares
            this per-user average across variants.
          </>
        ),
      };
    case "sum":
      return {
        label: "value / user (sum)",
        help: (
          <>
            Mean per-user total = <code>Σ x / n</code>, where each user&apos;s
            <code> x</code> = sum of their event values (LTV-style). You
            picked &ldquo;Sum values&rdquo;.
          </>
        ),
      };
    case "average":
      return {
        label: "value / user (avg)",
        help: (
          <>
            Mean per-user mean = <code>Σ x / n</code>, where each user&apos;s
            <code> x</code> = mean of their event values (AOV-style). You
            picked &ldquo;Average values per user&rdquo;.
          </>
        ),
      };
    case "once":
    default:
      return {
        label: "mean",
        help: (
          <>
            Per-user mean = <code>Σ x / n</code>. The Bayesian test compares
            treatment&apos;s mean against control&apos;s.
          </>
        ),
      };
  }
}

/* ── Metric table (Bayesian) ── */
function MetricTable({ section, label }: { section: MetricSection | null; label: string }) {
  if (!section) return null;
  const isProp = section.metric_type === "proportion";
  const typeLabel = section.metric_type + (section.inverse ? " · inverse" : "") + (section.unit ? ` (${section.unit})` : "");
  const valueColumn = describeValueColumn(section);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{label}: {section.event}</span>
        <span className="text-xs italic text-muted-foreground">{typeLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs leading-relaxed">
          <thead>
            <tr>
              <th className="text-left font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">variant</th>
              <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">n</th>
              {isProp && <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">conv</th>}
              <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">
                <span className="inline-flex items-center gap-1 justify-end">
                  {valueColumn.label}
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
                      <div className="text-left leading-snug whitespace-normal [&_code]:font-mono [&_code]:text-[0.95em]">
                        {valueColumn.help}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </span>
              </th>
              <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">rel&nbsp;&Delta;</th>
              <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">95%&nbsp;CI</th>
              <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">signal</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => {
              const signal = row.p_win ?? row.p_harm ?? row.p_increase ?? row.p_decrease_gt5pct;
              const signalLabel = row.p_win !== undefined ? "P(win)" : row.p_harm !== undefined ? "P(harm)" : row.p_increase !== undefined ? "P(increase)" : row.p_decrease_gt5pct !== undefined ? "P(↓>5%)" : "";
              const isGood = row.p_win !== undefined;
              return (
                <tr key={row.variant} className="hover:bg-muted/30">
                  <td className="px-2 py-1 border-b border-border/50 font-semibold">{row.variant}</td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{row.n.toLocaleString()}</td>
                  {isProp && <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{row.conversions?.toLocaleString() ?? "—"}</td>}
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">
                    {isProp ? pctPlain(row.rate) : row.mean?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">
                    {row.is_control ? "—" : pct(row.rel_delta)}
                  </td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">
                    {row.is_control ? "—" : `[${pct(row.ci_lower)}, ${pct(row.ci_upper)}]`}
                  </td>
                  <td className={`px-2 py-1 border-b border-border/50 tabular-nums text-right ${row.is_control ? "" : isGood ? pColor(signal, 0.95) : harmColor(signal)}`}>
                    {row.is_control ? "—" : signal !== undefined ? `${signalLabel} ${pctPlain(signal)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground italic">{section.verdict}</p>
    </div>
  );
}

/* ── Bayesian view ── */
function BayesianView({ data }: { data: BayesianAnalysis }) {
  return (
    <TooltipProvider delay={150}>
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Window: {data.window.start} → {data.window.end}</span>
        <span>Prior: {data.prior}</span>
        {data.computed_at && (
          <span>Data as of: {new Date(data.computed_at).toLocaleString("en-US")}</span>
        )}
      </div>

      {(data.warnings ?? []).map((w, i) => (
        <div key={i} className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          ⚠ {w}
        </div>
      ))}

      <SrmBadge srm={data.srm} />
      <MetricTable section={data.primary_metric} label="Primary Metric" />
      <PosteriorChart section={data.primary_metric} />

      {(data.guardrails ?? []).map((g) => (
        <MetricTable key={g.event} section={g} label="Guardrail" />
      ))}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <span className="font-medium text-muted-foreground">Sample check</span>
        <span className={data.sample_check.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400 font-semibold"}>
          {data.sample_check.ok ? "passed" : "BELOW MINIMUM"}
        </span>
        <span className="text-muted-foreground">
          (min {data.sample_check.minimum_per_variant}/variant —{" "}
          {Object.entries(data.sample_check.variants).map(([v, n]) => `${v}=${n}`).join(", ")})
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}

/* ── Bandit view ── */
function BanditView({ data }: { data: BanditAnalysis }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Window: {data.window.start} → {data.window.end}</span>
        <span>Algorithm: {data.algorithm}</span>
        {data.computed_at && (
          <span>Data as of: {new Date(data.computed_at).toLocaleString("en-US")}</span>
        )}
      </div>

      <SrmBadge srm={data.srm} />

      {/* Arm performance */}
      <div className="space-y-1">
        <span className="text-sm font-semibold">Arm Performance</span>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs leading-relaxed">
            <thead>
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">arm</th>
                <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">n</th>
                <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">clicks</th>
                <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">rate</th>
              </tr>
            </thead>
            <tbody>
              {data.arms.map((arm) => (
                <tr key={arm.arm} className="hover:bg-muted/30">
                  <td className={`px-2 py-1 border-b border-border/50 ${arm.arm === data.stopping.best_arm ? "font-semibold" : ""}`}>{arm.arm}</td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{arm.n.toLocaleString()}</td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{arm.conversions.toLocaleString()}</td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{pctPlain(arm.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thompson sampling */}
      <div className="space-y-1">
        <span className="text-sm font-semibold">Thompson Sampling</span>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs leading-relaxed">
            <thead>
              <tr>
                <th className="text-left font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">arm</th>
                <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">P(best)</th>
                <th className="text-right font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">weight</th>
              </tr>
            </thead>
            <tbody>
              {data.thompson_sampling.results.map((r) => (
                <tr key={r.arm} className="hover:bg-muted/30">
                  <td className={`px-2 py-1 border-b border-border/50 ${r.arm === data.stopping.best_arm ? "font-semibold" : ""}`}>{r.arm}</td>
                  <td className={`px-2 py-1 border-b border-border/50 tabular-nums text-right ${pColor(r.p_best, 0.95)}`}>
                    {r.p_best.toFixed(4)}
                  </td>
                  <td className="px-2 py-1 border-b border-border/50 tabular-nums text-right">{pctPlain(r.recommended_weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stopping */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <span className="font-medium text-muted-foreground">Stopping</span>
        <span className={data.stopping.met ? "text-green-700 dark:text-green-400 font-semibold" : "text-yellow-700 dark:text-yellow-400"}>
          {data.stopping.met ? "condition met" : "not yet met"}
        </span>
        <span className="text-muted-foreground">{data.stopping.message}</span>
      </div>
    </div>
  );
}

/* ── Flat JSON fallback (unrecognised schema) ── */
function FlatJsonFallback({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
          ⚠ Unrecognised analysis format — re-run the analysis script to get full rendering
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs leading-relaxed">
          <thead>
            <tr>
              <th className="text-left font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">Field</th>
              <th className="text-left font-semibold text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key} className="hover:bg-muted/30">
                <td className="px-2 py-1 border-b border-border/50 font-semibold">{key}</td>
                <td className="px-2 py-1 border-b border-border/50 tabular-nums">
                  {typeof value === "number"
                    ? Number.isInteger(value) ? value.toLocaleString() : value.toFixed(4)
                    : typeof value === "boolean"
                    ? value ? "✓ yes" : "✗ no"
                    : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Public component ── */
export function AnalysisView({ content }: { content: string }) {
  let data: AnalysisData;
  try {
    data = JSON.parse(content);
  } catch {
    // Fallback for legacy markdown strings
    return <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{content}</pre>;
  }

  if (data.type === "bayesian") return <BayesianView data={data as BayesianAnalysis} />;
  if (data.type === "bandit") return <BanditView data={data as BanditAnalysis} />;

  // Fallback: render unknown JSON as a readable key-value table
  return <FlatJsonFallback data={data} />;
}
