import { useMemo, useState } from "react";
import type { ExperimentRun } from "@/lib/release-decision-types";
import {
  parseVariantIdentities,
  splitVariantTokens,
  VariantIdentityInline,
} from "./variant-identity";

const PALETTE = [
  { bar: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { bar: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bar: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bar: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { bar: "bg-rose-500", light: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
] as const;

type ExpWithColor = ExperimentRun & { colorIdx: number };
type SamplingEntry = { variation: string; role: string; includeRate: number };

function palette(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "?";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "100%";
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function parseSamplingPlan(plan: string | null | undefined): SamplingEntry[] {
  if (!plan) return [];
  try {
    const parsed = JSON.parse(plan) as Partial<SamplingEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => entry.variation)
      .map(entry => ({
        variation: entry.variation ?? "",
        role: entry.role ?? "treatment",
        includeRate: Number(entry.includeRate ?? 100),
      }));
  } catch {
    return [];
  }
}

export function TrafficPoolView({
  experimentRuns,
  isSequential,
  variants,
}: {
  experimentRuns: ExperimentRun[];
  isSequential?: boolean;
  variants?: string | null;
}) {
  const variantRows = parseVariantIdentities(variants);
  const experimentRunsWithColor = useMemo(
    () => experimentRuns.map((run, index) => ({ ...run, colorIdx: index })),
    [experimentRuns],
  );
  const withDates = experimentRunsWithColor.filter(run => run.observationStart);

  if (experimentRuns.length === 0) return null;

  return (
    <div className="divide-y rounded-md border">
      <div className="space-y-2.5 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Layer & Sampling
        </div>
        <LayerSamplingSummary experimentRuns={experimentRunsWithColor} variants={variantRows} />
      </div>

      {withDates.length > 0 && (
        <div className="space-y-2 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Observation Windows
          </div>
          <Timeline experimentRuns={experimentRunsWithColor} isSequential={isSequential} />
        </div>
      )}

      {withDates.length === 0 && (
        <div className="px-3 py-2.5">
          <p className="text-[10px] italic text-muted-foreground/50">
            No observation windows.
          </p>
        </div>
      )}
    </div>
  );
}

function LayerSamplingSummary({
  experimentRuns,
  variants,
}: {
  experimentRuns: ExpWithColor[];
  variants: ReturnType<typeof parseVariantIdentities>;
}) {
  const layers = useMemo(() => {
    const map = new Map<string, ExpWithColor[]>();
    for (const run of experimentRuns) {
      const key = run.layerKey?.trim() || run.layerId?.trim() || "default";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(run);
    }
    return Array.from(map.entries());
  }, [experimentRuns]);

  return (
    <div className="grid gap-2">
      {layers.map(([layerKey, runs]) => (
        <div key={layerKey} className="rounded border bg-background/70 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-mono text-[10px] font-semibold">
                {layerKey}
              </div>
            </div>
            <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {runs.length} run{runs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-1">
            {runs.map(run => (
              <RunSamplingRow key={run.id} run={run} variants={variants} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunSamplingRow({
  run,
  variants,
}: {
  run: ExpWithColor;
  variants: ReturnType<typeof parseVariantIdentities>;
}) {
  const color = palette(run.colorIdx);
  const samplingPlan = parseSamplingPlan(run.analysisSamplingPlan);
  const treatments = splitVariantTokens(run.treatmentVariant);

  return (
    <div className={`${color.light} rounded border px-2 py-1.5`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className={`size-2 rounded-sm ${color.dot}`} />
        <span className={`font-mono text-[10px] font-semibold ${color.text}`}>{run.slug}</span>
        <span className="text-[10px] text-muted-foreground">
          layer {fmtPercent(run.layerTrafficPercent)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          unit <span className="font-mono">{run.assignmentUnitSelector || "user.keyId"}</span>
        </span>
        {run.method === "bandit" && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">bandit</span>
        )}
      </div>
      <div className="mt-1 grid gap-0.5 pl-4 text-[10px]">
        <VariantIdentityInline
          token={run.controlVariant}
          variants={variants}
          role={run.method === "bandit" ? "Baseline" : "Control"}
          className="min-w-0"
        />
        {treatments.map((variant, index) => (
          <VariantIdentityInline
            key={`${variant}-${index}`}
            token={variant}
            variants={variants}
            role={run.method === "bandit" ? "Arm" : "Treatment"}
            className="min-w-0"
          />
        ))}
      </div>
      {samplingPlan.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 pl-4">
          {samplingPlan.map(entry => (
            <span
              key={`${entry.variation}-${entry.role}`}
              className="rounded border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
            >
              {entry.role}: {entry.variation} {fmtPercent(entry.includeRate)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Timeline({ experimentRuns, isSequential }: { experimentRuns: ExpWithColor[]; isSequential?: boolean }) {
  const [now] = useState(() => Date.now());
  const withDates = experimentRuns.filter(run => run.observationStart);
  if (withDates.length === 0) return null;

  const starts = withDates.map(run => new Date(run.observationStart!).getTime());
  const ends = withDates.map(run =>
    run.observationEnd ? new Date(run.observationEnd).getTime() : now,
  );
  const minTime = Math.min(...starts);
  const maxTime = Math.max(...ends);
  const totalMs = Math.max(maxTime - minTime, 1);

  return (
    <div className="space-y-1">
      <div className="flex pl-24">
        <div className="flex flex-1 justify-between text-[9px] text-muted-foreground/40">
          <span>{fmtDate(new Date(minTime))}</span>
          <span>{fmtDate(new Date(maxTime))}</span>
        </div>
      </div>
      {withDates.map((run, index) => {
        const start = new Date(run.observationStart!).getTime();
        const end = run.observationEnd ? new Date(run.observationEnd).getTime() : now;
        const leftPct = ((start - minTime) / totalMs) * 100;
        const widthPct = ((end - start) / totalMs) * 100;
        const isOngoing = !run.observationEnd;
        const color = palette(run.colorIdx);
        const phaseLabel = isSequential ? `Phase ${index + 1}` : `#${index + 1}`;

        return (
          <div key={run.id} className="flex items-center gap-2">
            <div className="w-28 min-w-0 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[9px] font-medium text-muted-foreground/60">{phaseLabel}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {run.slug}
                </span>
              </div>
            </div>
            <div className="relative h-5 flex-1">
              <div className="absolute inset-0 rounded bg-muted/20" />
              <div
                className={`absolute inset-y-0 rounded ${color.bar} opacity-75 ${isOngoing ? "rounded-r-none" : ""}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center truncate px-1 text-[8px] font-medium text-white/90">
                  {widthPct > 15 ? `${fmtDate(run.observationStart)} -> ${isOngoing ? "ongoing" : fmtDate(run.observationEnd)}` : ""}
                </span>
              </div>
              {isOngoing && (
                <div
                  className={`absolute inset-y-0 w-1.5 ${color.bar} opacity-40`}
                  style={{ left: `calc(${leftPct + widthPct}% - 2px)` }}
                />
              )}
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
              {fmtDate(run.observationStart)} {"->"} {isOngoing ? "ongoing" : fmtDate(run.observationEnd)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
